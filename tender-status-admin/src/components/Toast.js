import React, { useState, useEffect } from 'react';

const Toast = ({ message, type = 'success', duration = 4000, onClose }) => {
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsExiting(true);
            setTimeout(onClose, 300); // Wait for exit animation
        }, duration);

        return () => clearTimeout(timer);
    }, [duration, onClose]);

    const getIcon = () => {
        switch (type) {
            case 'success':
                return '✓';
            case 'error':
                return '✕';
            case 'warning':
                return '⚠';
            default:
                return 'ℹ';
        }
    };

    const handleClose = () => {
        setIsExiting(true);
        setTimeout(onClose, 300);
    };

    return (
        <div className={`toast toast-${type} ${isExiting ? 'toast-exit' : ''}`}>
            <span className="toast-icon">{getIcon()}</span>
            <div className="toast-content">{message}</div>
            <button className="toast-close" onClick={handleClose}>
                ×
            </button>
            <div className="toast-progress"></div>
        </div>
    );
};

export default Toast;