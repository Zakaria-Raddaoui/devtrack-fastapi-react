import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import QuickCapture from './QuickCapture';

/**
 * Self-contained global Quick Capture — fetches its own topics.
 * Mounted once in Layout so it can be triggered from any page
 * via Ctrl+Shift+V or a button anywhere in the app.
 */
export default function QuickCaptureGlobal({ open, onClose }) {
    const [topics, setTopics] = useState([]);

    useEffect(() => {
        if (!open) return;
        api.get('/topics/?limit=100')
            .then(r => setTopics(r.data))
            .catch(() => { });
    }, [open]);

    if (!open) return null;

    return (
        <QuickCapture
            topics={topics}
            onClose={onClose}
            onSaved={onClose}
        />
    );
}