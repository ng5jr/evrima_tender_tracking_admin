import { useState, useCallback } from 'react';

const useToast = () => {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = 'success', duration = 4000) => {
        const id = Date.now() + Math.random(); // Ensure uniqueness
        const newToast = { id, message, type, duration };

        setToasts(prev => [...prev, newToast]);

        return id;
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    const clearAllToasts = useCallback(() => {
        setToasts([]);
    }, []);

    // Helper methods for different toast types
    const showSuccess = useCallback((message, duration) => {
        return addToast(message, 'success', duration);
    }, [addToast]);

    const showError = useCallback((message, duration) => {
        return addToast(message, 'error', duration);
    }, [addToast]);

    const showWarning = useCallback((message, duration) => {
        return addToast(message, 'warning', duration);
    }, [addToast]);

    const showInfo = useCallback((message, duration) => {
        return addToast(message, 'info', duration);
    }, [addToast]);

    return {
        toasts,
        addToast,
        removeToast,
        clearAllToasts,
        showSuccess,
        showError,
        showWarning,
        showInfo
    };
};

export default useToast;