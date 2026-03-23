from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import httpx
import re
from bs4 import BeautifulSoup
from urllib.parse import urlparse

import models
import schemas
import security
from database import get_db

router = APIRouter(prefix="/capture", tags=["capture"])

# ─── Request/Response models ──────────────────────────────────────────────────

class CaptureRequest(BaseModel):
    url: str

class CaptureResponse(BaseModel):
    url:               str
    capture_type:      str          # "github_pr" | "github_commit" | "youtube" | "leetcode" | "generic"
    title:             str
    subtitle:          Optional[str] = None
    description:       Optional[str] = None
    suggested_minutes: Optional[int] = None
    suggested_topic_id: Optional[int] = None
    suggested_topic_title: Optional[str] = None
    metadata:          dict = {}

# ─── URL type detection ───────────────────────────────────────────────────────

def detect_type(url: str) -> str:
    u = url.lower()
    if "github.com" in u and "/pull/" in u:      return "github_pr"
    if "github.com" in u and "/commit/" in u:    return "github_commit"
    if "github.com" in u and "/issues/" in u:    return "github_issue"
    if "github.com" in u:                         return "github_repo"
    if "youtube.com" in u or "youtu.be" in u:    return "youtube"
    if "leetcode.com/problems/" in u:             return "leetcode"
    if "udemy.com" in u:                          return "course"
    if "coursera.org" in u:                       return "course"
    if "medium.com" in u:                         return "article"
    if "dev.to" in u:                             return "article"
    if "hashnode" in u:                           return "article"
    if "stackoverflow.com" in u:                  return "stackoverflow"
    if "docs." in u:                              return "docs"
    return "generic"


def extract_github_info(url: str) -> dict:
    """Extract repo, PR number, branch from GitHub URL."""
    parsed = urlparse(url)
    parts  = parsed.path.strip('/').split('/')
    info   = {}
    if len(parts) >= 2:
        info['owner'] = parts[0]
        info['repo']  = parts[1]
    if '/pull/' in url and len(parts) >= 4:
        info['pr_number'] = parts[3]
    if '/commit/' in url and len(parts) >= 4:
        info['commit_sha'] = parts[3][:7]
    if '/issues/' in url and len(parts) >= 4:
        info['issue_number'] = parts[3]
    return info


def extract_youtube_id(url: str) -> Optional[str]:
    patterns = [
        r'(?:youtube\.com/watch\?v=|youtu\.be/)([a-zA-Z0-9_-]{11})',
    ]
    for p in patterns:
        m = re.search(p, url)
        if m:
            return m.group(1)
    return None


def guess_minutes(capture_type: str, metadata: dict) -> Optional[int]:
    """Rough time estimate based on content type."""
    if capture_type == "youtube":
        duration = metadata.get("duration_seconds")
        if duration:
            return max(5, int(duration / 60))
        return 30
    if capture_type in ("github_pr", "github_commit"):
        files = metadata.get("files_changed", 0)
        return min(120, max(15, files * 5))
    if capture_type == "leetcode":
        difficulty = metadata.get("difficulty", "").lower()
        if difficulty == "easy":   return 20
        if difficulty == "medium": return 45
        if difficulty == "hard":   return 90
        return 30
    if capture_type in ("article", "docs"):
        return 20
    if capture_type == "course":
        return 45
    return 25


def match_topic(title: str, subtitle: str, topics: List[models.Topic]) -> Optional[models.Topic]:
    """Try to match URL content to one of the user's topics."""
    if not topics:
        return None
    combined = f"{title} {subtitle or ''}".lower()
    best_topic = None
    best_score = 0
    for topic in topics:
        topic_words = set(re.findall(r'\w+', topic.title.lower()))
        content_words = set(re.findall(r'\w+', combined))
        score = len(topic_words & content_words)
        if topic.description:
            desc_words = set(re.findall(r'\w+', topic.description.lower()))
            score += len(desc_words & content_words) * 0.5
        if score > best_score:
            best_score = score
            best_topic = topic
    return best_topic if best_score > 0 else None


async def fetch_page_metadata(url: str) -> dict:
    """Fetch a page and extract og/meta tags."""
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; DevTrack/1.0)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
    }
    try:
        async with httpx.AsyncClient(timeout=8, follow_redirects=True) as client:
            res = await client.get(url, headers=headers)
            if res.status_code != 200:
                return {}
            soup = BeautifulSoup(res.text, "html.parser")

            def og(prop):
                tag = soup.find("meta", property=f"og:{prop}") or \
                      soup.find("meta", attrs={"name": prop})
                return tag.get("content", "").strip() if tag else ""

            title    = og("title") or (soup.title.string.strip() if soup.title else "")
            desc     = og("description")
            image    = og("image")
            sitename = og("site_name")

            # YouTube duration
            duration = None
            dur_tag  = soup.find("meta", itemprop="duration")
            if dur_tag:
                raw = dur_tag.get("content", "")
                m   = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', raw)
                if m:
                    h, mn, s = (int(x or 0) for x in m.groups())
                    duration = h * 3600 + mn * 60 + s

            # LeetCode difficulty
            difficulty = None
            diff_tag   = soup.find("div", string=re.compile(r'Easy|Medium|Hard'))
            if not diff_tag:
                for tag in soup.find_all(["span", "div", "label"]):
                    text = tag.get_text().strip()
                    if text in ("Easy", "Medium", "Hard"):
                        difficulty = text
                        break

            # GitHub-specific: files changed from the page
            files_changed = 0
            files_tag = soup.find(id="files_bucket")
            if files_tag:
                file_headers = files_tag.find_all(class_="file-header")
                files_changed = len(file_headers)

            return {
                "title":         title,
                "description":   desc,
                "image":         image,
                "site_name":     sitename,
                "duration_seconds": duration,
                "difficulty":    difficulty,
                "files_changed": files_changed,
            }
    except Exception as e:
        return {"error": str(e)}


# ─── Main endpoint ────────────────────────────────────────────────────────────

@router.post("/analyze", response_model=CaptureResponse)
async def analyze_url(
    req: CaptureRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    url          = req.url.strip()
    capture_type = detect_type(url)
    parsed       = urlparse(url)
    domain       = parsed.netloc.replace("www.", "")

    # Fetch page metadata
    meta = await fetch_page_metadata(url)
    raw_title = meta.get("title", "")
    desc      = meta.get("description", "")

    # ── Build clean title + subtitle by type ─────────────────────────────────
    title    = raw_title
    subtitle = ""
    extra    = {}

    gh = extract_github_info(url) if "github.com" in url else {}

    if capture_type == "github_pr":
        repo    = f"{gh.get('owner', '')}/{gh.get('repo', '')}"
        pr_num  = gh.get("pr_number", "")
        # Title is usually "Title · Pull Request #N · owner/repo"
        clean   = re.sub(r'\s*·\s*Pull Request.*$', '', raw_title, flags=re.IGNORECASE).strip()
        title   = clean or f"PR #{pr_num}"
        subtitle = f"{repo} · PR #{pr_num}"
        extra   = {"repo": repo, "pr_number": pr_num, "files_changed": meta.get("files_changed", 0)}

    elif capture_type == "github_commit":
        repo   = f"{gh.get('owner', '')}/{gh.get('repo', '')}"
        sha    = gh.get("commit_sha", "")
        clean  = re.sub(r'\s*·\s*.*$', '', raw_title).strip()
        title  = clean or f"Commit {sha}"
        subtitle = f"{repo} · {sha}"
        extra  = {"repo": repo, "commit_sha": sha}

    elif capture_type == "github_issue":
        repo  = f"{gh.get('owner', '')}/{gh.get('repo', '')}"
        clean = re.sub(r'\s*·\s*Issue.*$', '', raw_title, flags=re.IGNORECASE).strip()
        title = clean or raw_title
        subtitle = f"{repo} · Issue #{gh.get('issue_number', '')}"
        extra = {"repo": repo}

    elif capture_type == "github_repo":
        repo  = f"{gh.get('owner', '')}/{gh.get('repo', '')}"
        title = raw_title.split(":")[0].strip() or repo
        subtitle = f"GitHub · {repo}"
        extra = {"repo": repo}

    elif capture_type == "youtube":
        # Title is usually "Video Title - YouTube"
        clean = re.sub(r'\s*[-|]\s*YouTube\s*$', '', raw_title, flags=re.IGNORECASE).strip()
        title = clean or raw_title
        subtitle = "YouTube"
        dur   = meta.get("duration_seconds")
        if dur:
            h, m = divmod(dur // 60, 60)
            subtitle += f" · {h}h {m}m" if h else f" · {m} min"
        extra = {"video_id": extract_youtube_id(url), "duration_seconds": dur}

    elif capture_type == "leetcode":
        clean = re.sub(r'\s*[-|]\s*LeetCode\s*$', '', raw_title, flags=re.IGNORECASE).strip()
        title = clean or raw_title
        diff  = meta.get("difficulty", "")
        subtitle = f"LeetCode · {diff}" if diff else "LeetCode"
        extra = {"difficulty": diff}

    elif capture_type == "course":
        clean = re.sub(r'\s*[-|]\s*(Udemy|Coursera)\s*$', '', raw_title, flags=re.IGNORECASE).strip()
        title = clean or raw_title
        subtitle = domain.capitalize()
        extra = {}

    elif capture_type == "article":
        clean = re.sub(r'\s*[-|]\s*(Medium|DEV Community|Hashnode)\s*.*$', '', raw_title, flags=re.IGNORECASE).strip()
        title = clean or raw_title
        subtitle = domain
        extra = {}

    else:
        title    = raw_title or url
        subtitle = domain
        extra    = {}

    # Clean up empty title fallback
    if not title or title == domain:
        title = url[:60] + ("..." if len(url) > 60 else "")

    # ── Match to user's topics ────────────────────────────────────────────────
    topics = db.query(models.Topic).filter(models.Topic.owner_id == current_user.id).all()
    matched = match_topic(title, subtitle + " " + desc, topics)

    suggested_minutes = guess_minutes(capture_type, {**meta, **extra})

    return CaptureResponse(
        url=url,
        capture_type=capture_type,
        title=title,
        subtitle=subtitle,
        description=desc[:200] if desc else None,
        suggested_minutes=suggested_minutes,
        suggested_topic_id=matched.id if matched else None,
        suggested_topic_title=matched.title if matched else None,
        metadata=extra,
    )