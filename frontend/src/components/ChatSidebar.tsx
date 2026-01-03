import { useState } from 'react';
import type { ChatMessage } from '../types';
import './ChatSidebar.css';

interface ChatSidebarProps {
    selectedText: string;
    messages: ChatMessage[];
    onSendPrompt: (prompt: string) => void;
    isLoading: boolean;
}

export function ChatSidebar({
    selectedText,
    messages,
    onSendPrompt,
    isLoading,
}: ChatSidebarProps) {
    const [prompt, setPrompt] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim() || isLoading) return;
        onSendPrompt(prompt);
        setPrompt('');
    };

    return (
        <aside className="chat-sidebar">
            {selectedText && (
                <div className="selected-text">
                    <span className="label">Selected Text</span>
                    <p>{selectedText}</p>
                </div>
            )}

            <div className="chat-messages">
                {messages.length === 0 ? (
                    <div className="chat-empty">
                        <p>Select text from the resume and ask for improvements</p>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div key={msg.id} className={`chat-message ${msg.role}`}>
                            <p>{msg.content}</p>
                        </div>
                    ))
                )}
            </div>

            <form className="chat-input-form" onSubmit={handleSubmit}>
                <input
                    type="text"
                    className="chat-input"
                    placeholder={selectedText ? "How should I improve this?" : "Select text first..."}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    disabled={!selectedText || isLoading}
                />
                <button
                    type="submit"
                    className="chat-send"
                    disabled={!prompt.trim() || !selectedText || isLoading}
                >
                    {isLoading ? '...' : '→'}
                </button>
            </form>
        </aside>
    );
}
