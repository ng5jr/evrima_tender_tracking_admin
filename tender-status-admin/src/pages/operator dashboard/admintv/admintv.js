import React, { useState, useEffect } from 'react';
import { db as firestore } from '../../../firebase/firebaseconfig.js';
import { doc, setDoc, getDoc, updateDoc, deleteField } from 'firebase/firestore';
import './admintv.css';

const AdminTV = () => {
    const [selectedImage, setSelectedImage] = useState(null);
    const [imageUrl, setImageUrl] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState('');

    // The document ID where we'll store the image
    const TVImageDocId = 'tvDisplay';

    // Fetch the current image from Firestore when component mounts
    useEffect(() => {
        const fetchImage = async () => {
            try {
                const docRef = doc(firestore, 'displayImages', TVImageDocId);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists() && docSnap.data().imageData) {
                    setImageUrl(docSnap.data().imageData);
                }
            } catch (err) {
                console.error('Error fetching image:', err);
                setError('Failed to load the image');
            }
        };

        fetchImage();
    }, []);

    const handleImageChange = (e) => {
        if (e.target.files[0]) {
            setSelectedImage(e.target.files[0]);
        }
    };

    // Function to convert image file to base64
    const convertToBase64 = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = (error) => reject(error);
        });
    };

    const handleUpload = async () => {
        if (!selectedImage) {
            setError('Please select an image first');
            return;
        }

        // Check file size - limit to 1MB
        if (selectedImage.size > 1024 * 1024) {
            setError('Image must be less than 1MB');
            return;
        }

        setIsUploading(true);
        setError('');

        try {
            // Convert image to base64
            const base64Image = await convertToBase64(selectedImage);

            // Store the base64 string in Firestore
            const docRef = doc(firestore, 'displayImages', TVImageDocId);
            await setDoc(docRef, {
                imageData: base64Image,
                updatedAt: new Date()
            }, { merge: true });

            // Update state
            setImageUrl(base64Image);
            setSelectedImage(null);

            alert('Image uploaded successfully!');
        } catch (err) {
            console.error('Error uploading image:', err);
            setError('Failed to upload image');
        } finally {
            setIsUploading(false);
        }
    };

    const handleDelete = async () => {
        if (!imageUrl) {
            setError('No image to delete');
            return;
        }

        setIsDeleting(true);
        setError('');

        try {
            // Remove image from Firestore
            const docRef = doc(firestore, 'displayImages', TVImageDocId);
            await updateDoc(docRef, {
                imageData: deleteField()
            });

            // Update state
            setImageUrl('');

            alert('Image deleted successfully!');
        } catch (err) {
            console.error('Error deleting image:', err);
            setError('Failed to delete image');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="admin-tv-container">
            <h1>EVRIMA TV DASHBOARD</h1>

            <div className="image-upload-section">
                <h2>Upload New Image</h2>
                <input
                    type="file"
                    onChange={handleImageChange}
                    accept="image/*"
                    className="file-input"
                />
                <p className="warning-message">Image must be less than 1MB</p>

                <div className="action-buttons">
                    <button
                        onClick={handleUpload}
                        disabled={isUploading || !selectedImage}
                        className="upload-button"
                    >
                        {isUploading ? 'Uploading...' : 'Upload Image'}
                    </button>

                    <button
                        onClick={handleDelete}
                        disabled={isDeleting || !imageUrl}
                        className="delete-button"
                    >
                        {isDeleting ? 'Deleting...' : 'Delete Image'}
                    </button>
                </div>

                {error && <p className="error-message">{error}</p>}
            </div>

            <div className="image-preview-section">
                <h2>This image will be displayed in Guest Services TV</h2>
                <div className="image-container">
                    {imageUrl ? (
                        <img src={imageUrl} alt="TV Display" className="preview-image" />
                    ) : (
                        <div className="no-image-placeholder">
                            <p>No image uploaded</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminTV;