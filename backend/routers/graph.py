from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List, Dict, Set
import re
from collections import defaultdict

import models
import security
from database import get_db

router = APIRouter(prefix="/graph", tags=["graph"])

# ─── Tech keyword taxonomy ────────────────────────────────────────────────────

TECH_DOMAINS = {
    "frontend": [
        "react",
        "vue",
        "angular",
        "html",
        "css",
        "javascript",
        "typescript",
        "tailwind",
        "sass",
        "scss",
        "webpack",
        "vite",
        "nextjs",
        "next.js",
        "redux",
        "graphql",
        "restapi",
        "rest",
        "api",
        "dom",
        "jsx",
        "component",
        "hooks",
        "state",
        "props",
        "ui",
        "ux",
        "responsive",
        "bootstrap",
        "svelte",
        "nuxt",
        "gatsby",
        "astro",
    ],
    "backend": [
        "python",
        "nodejs",
        "node",
        "fastapi",
        "django",
        "flask",
        "express",
        "java",
        "spring",
        "golang",
        "go",
        "rust",
        "php",
        "laravel",
        "ruby",
        "rails",
        "dotnet",
        ".net",
        "csharp",
        "c#",
        "server",
        "api",
        "rest",
        "graphql",
        "websocket",
        "microservices",
        "authentication",
        "jwt",
        "oauth",
        "middleware",
        "sqlalchemy",
        "orm",
        "prisma",
    ],
    "devops": [
        "docker",
        "kubernetes",
        "k8s",
        "ci/cd",
        "cicd",
        "jenkins",
        "github actions",
        "gitlab",
        "terraform",
        "ansible",
        "puppet",
        "chef",
        "nginx",
        "apache",
        "linux",
        "bash",
        "shell",
        "aws",
        "azure",
        "gcp",
        "cloud",
        "devops",
        "deployment",
        "container",
        "pod",
        "helm",
        "monitoring",
        "prometheus",
        "grafana",
        "elk",
        "logging",
        "infrastructure",
        "iac",
        "pipeline",
    ],
    "database": [
        "sql",
        "mysql",
        "postgresql",
        "postgres",
        "sqlite",
        "mongodb",
        "redis",
        "elasticsearch",
        "cassandra",
        "dynamodb",
        "firebase",
        "supabase",
        "database",
        "nosql",
        "schema",
        "migration",
        "index",
        "query",
        "transaction",
        "acid",
        "normalization",
        "orm",
        "prisma",
        "sqlalchemy",
    ],
    "ai_ml": [
        "machine learning",
        "ml",
        "deep learning",
        "neural network",
        "ai",
        "tensorflow",
        "pytorch",
        "keras",
        "scikit",
        "pandas",
        "numpy",
        "nlp",
        "llm",
        "gpt",
        "transformer",
        "embeddings",
        "vector",
        "classification",
        "regression",
        "clustering",
        "computer vision",
        "data science",
        "statistics",
        "matplotlib",
        "jupyter",
    ],
    "networking": [
        "networking",
        "tcp",
        "udp",
        "http",
        "https",
        "dns",
        "ip",
        "osi",
        "firewall",
        "vpn",
        "proxy",
        "load balancer",
        "ssl",
        "tls",
        "websocket",
        "grpc",
        "protocol",
        "subnet",
        "routing",
        "cdn",
    ],
    "security": [
        "security",
        "authentication",
        "authorization",
        "jwt",
        "oauth",
        "encryption",
        "hashing",
        "ssl",
        "tls",
        "xss",
        "csrf",
        "sql injection",
        "penetration",
        "vulnerability",
        "firewall",
        "vpn",
        "cybersecurity",
        "owasp",
        "cors",
        "https",
        "certificate",
    ],
    "cs_fundamentals": [
        "algorithms",
        "data structures",
        "complexity",
        "sorting",
        "searching",
        "recursion",
        "dynamic programming",
        "graph theory",
        "tree",
        "linked list",
        "stack",
        "queue",
        "hash table",
        "binary search",
        "big o",
        "design patterns",
        "solid",
        "oop",
        "functional",
        "concurrency",
        "multithreading",
        "async",
        "memory management",
        "os",
        "operating system",
    ],
}

# ─── Prerequisite map ─────────────────────────────────────────────────────────

PREREQUISITES = {
    "kubernetes": ["docker", "networking", "linux"],
    "k8s": ["docker", "networking", "linux"],
    "docker": ["linux", "networking"],
    "react": ["javascript", "html", "css"],
    "nextjs": ["react", "javascript"],
    "next.js": ["react", "javascript"],
    "angular": ["typescript", "javascript", "html"],
    "vue": ["javascript", "html", "css"],
    "typescript": ["javascript"],
    "fastapi": ["python", "rest"],
    "django": ["python", "sql"],
    "flask": ["python", "rest"],
    "express": ["nodejs", "javascript"],
    "graphql": ["api", "rest"],
    "tensorflow": ["python", "machine learning", "numpy"],
    "pytorch": ["python", "machine learning", "numpy"],
    "aws": ["linux", "networking", "cloud"],
    "terraform": ["cloud", "devops"],
    "helm": ["kubernetes", "docker"],
    "postgresql": ["sql", "database"],
    "mongodb": ["database", "nosql"],
    "redis": ["database"],
    "jwt": ["authentication", "security"],
    "oauth": ["authentication", "security", "http"],
    "grpc": ["networking", "api"],
    "nginx": ["linux", "networking"],
    "ci/cd": ["git", "linux"],
    "machine learning": ["python", "statistics", "numpy"],
    "deep learning": ["machine learning", "python", "numpy"],
    "nlp": ["machine learning", "python"],
    "spring": ["java", "oop"],
    "rails": ["ruby"],
}

# ─── Helpers ──────────────────────────────────────────────────────────────────


def extract_keywords(text: str) -> Set[str]:
    """Extract known tech keywords from a block of text."""
    if not text:
        return set()
    text_lower = text.lower()
    found = set()
    all_keywords = {kw for domain_kws in TECH_DOMAINS.values() for kw in domain_kws}
    for kw in all_keywords:
        # Word boundary match
        pattern = r"\b" + re.escape(kw) + r"\b"
        if re.search(pattern, text_lower):
            found.add(kw)
    return found


def get_domain(keyword: str) -> str:
    for domain, keywords in TECH_DOMAINS.items():
        if keyword in keywords:
            return domain
    return "other"


def get_domain_color(domain: str) -> str:
    colors = {
        "frontend": "#3b82f6",
        "backend": "#f97316",
        "devops": "#22c55e",
        "database": "#a855f7",
        "ai_ml": "#ec4899",
        "networking": "#14b8a6",
        "security": "#ef4444",
        "cs_fundamentals": "#f59e0b",
        "other": "#6b7280",
    }
    return colors.get(domain, "#6b7280")


# ─── Endpoint ─────────────────────────────────────────────────────────────────


@router.get("/data")
def get_graph_data(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    topics = (
        db.query(models.Topic).filter(models.Topic.owner_id == current_user.id).all()
    )
    logs = db.query(models.Log).filter(models.Log.user_id == current_user.id).all()
    notes = db.query(models.Note).filter(models.Note.owner_id == current_user.id).all()
    resources = (
        db.query(models.Resource)
        .filter(models.Resource.owner_id == current_user.id)
        .all()
    )

    # ── Step 1: build keyword → contexts map ─────────────────────────────────
    # keyword_sources[kw] = set of topic_ids that mention it
    keyword_topic_ids: Dict[str, Set[int]] = defaultdict(set)
    # keyword_weight[kw] = how many times it appears total
    keyword_weight: Dict[str, int] = defaultdict(int)

    # From topic titles + descriptions
    for t in topics:
        text = f"{t.title} {t.description or ''}"
        kws = extract_keywords(text)
        # Always include the topic title as a node itself
        title_lower = t.title.lower().strip()
        kws.add(title_lower)
        for kw in kws:
            keyword_topic_ids[kw].add(t.id)
            keyword_weight[kw] += 3  # topics weighted higher

    # From logs
    topic_minutes: Dict[int, int] = defaultdict(int)
    for l in logs:
        if l.topic_id:
            topic_minutes[l.topic_id] += l.time_spent
        kws = extract_keywords(l.notes or "")
        for kw in kws:
            if l.topic_id:
                keyword_topic_ids[kw].add(l.topic_id)
            keyword_weight[kw] += 1

    # From notes
    for n in notes:
        text = f"{n.title} {n.content or ''} {n.tags or ''}"
        kws = extract_keywords(text)
        for kw in kws:
            keyword_weight[kw] += 1

    # From resources
    for r in resources:
        text = f"{r.title} {r.resource_type or ''}"
        kws = extract_keywords(text)
        for kw in kws:
            keyword_weight[kw] += 1

    # ── Step 2: Build nodes ───────────────────────────────────────────────────
    # Only include keywords that appear at least once
    topic_id_to_title = {t.id: t.title for t in topics}
    topic_id_to_status = {t.id: t.status.value for t in topics}

    # node_id → node data
    nodes = {}

    for kw, weight in keyword_weight.items():
        if weight < 1:
            continue
        domain = get_domain(kw)
        color = get_domain_color(domain)
        # Find which topic this keyword belongs to (if any)
        t_ids = keyword_topic_ids.get(kw, set())
        hours = sum(topic_minutes.get(tid, 0) for tid in t_ids) / 60
        is_topic = any(
            kw == t.title.lower().strip() or kw in t.title.lower() for t in topics
        )
        status = None
        topic_id = None
        for t in topics:
            if kw == t.title.lower().strip():
                status = t.status.value
                topic_id = t.id
                break

        nodes[kw] = {
            "id": kw,
            "label": kw.title(),
            "domain": domain,
            "color": color,
            "weight": weight,
            "hours": round(hours, 1),
            "is_topic": is_topic,
            "status": status,
            "topic_id": topic_id,
        }

    # ── Step 3: Build edges (co-occurrence) ───────────────────────────────────
    edges = []
    edge_set = set()
    node_list = list(nodes.keys())

    for i in range(len(node_list)):
        for j in range(i + 1, len(node_list)):
            a, b = node_list[i], node_list[j]
            # Edge if they share a topic context
            shared = keyword_topic_ids[a] & keyword_topic_ids[b]
            if shared:
                edge_key = tuple(sorted([a, b]))
                if edge_key not in edge_set:
                    edge_set.add(edge_key)
                    edges.append(
                        {
                            "source": a,
                            "target": b,
                            "strength": len(shared),
                        }
                    )
            # Edge if they're in the same domain
            elif (
                nodes[a]["domain"] == nodes[b]["domain"]
                and nodes[a]["domain"] != "other"
            ):
                edge_key = tuple(sorted([a, b]))
                if edge_key not in edge_set:
                    edge_set.add(edge_key)
                    edges.append(
                        {
                            "source": a,
                            "target": b,
                            "strength": 0.3,
                        }
                    )

    # ── Step 4: Detect missing prerequisites ─────────────────────────────────
    known_keywords = set(nodes.keys())
    missing_prereqs = []

    for kw in known_keywords:
        prereqs = PREREQUISITES.get(kw, [])
        for prereq in prereqs:
            if prereq not in known_keywords:
                missing_prereqs.append(
                    {
                        "topic": kw.title(),
                        "missing": prereq.title(),
                        "severity": (
                            "warning" if keyword_weight.get(kw, 0) > 2 else "info"
                        ),
                    }
                )

    # ── Step 5: Domain clusters ───────────────────────────────────────────────
    domain_counts: Dict[str, int] = defaultdict(int)
    for node in nodes.values():
        domain_counts[node["domain"]] += 1

    clusters = [
        {
            "domain": domain,
            "label": domain.replace("_", " ").title(),
            "count": count,
            "color": get_domain_color(domain),
        }
        for domain, count in sorted(domain_counts.items(), key=lambda x: -x[1])
        if domain != "other" and count > 0
    ]

    return {
        "nodes": list(nodes.values()),
        "edges": edges,
        "missing_prereqs": missing_prereqs[:12],  # cap to most relevant
        "clusters": clusters,
        "stats": {
            "total_nodes": len(nodes),
            "total_edges": len(edges),
            "domains": len(clusters),
        },
    }
