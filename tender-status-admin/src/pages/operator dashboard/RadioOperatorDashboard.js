import React, { useState, useEffect } from "react";
// Import the Firebase configuration object containing database and authentication instances.
import { db, handleSignOut } from "../../firebase/firebaseconfig";
// Import specific functions from the Firebase Firestore library.
import {
  collection, // Used to create a reference to a collection in the database.
  addDoc, // Used to add a new document to a collection.
  getDocs, // Used to retrieve multiple documents from a collection.
  deleteDoc, // Used to delete a specific document from a collection.
  doc, // Used to create a reference to a specific document by its ID.
  serverTimestamp, // Used to generate a timestamp on the Firebase server.
  query, // Used to build and configure database queries.
  orderBy, // Used in a query to order the documents by a specific field.
  onSnapshot, // Used to listen for real-time updates to a query.
} from "firebase/firestore";
// Import the CSS file for styling this component.
import "./RadioOperatorDashboard.css";
// Import the Logo component, presumably for displaying a logo.
import Logo from "../../components/logo";
import { Link } from "react-router-dom";

// Define the main functional component for the Radio Operator Dashboard.
function RadioOperatorDashboard() {
  // State variable to store the selected action (e.g., 'ARRIVING', 'DEPARTING').
  const [action, setAction] = useState("");
  // State variable to store the selected direction or location (e.g., 'SHORESIDE', 'SHIPSIDE').
  const [direction, setDirection] = useState("");
  // State variable to display a preview of the notification message based on the selected action and direction.
  const [previewMessage, setPreviewMessage] = useState("");
  // State variable to store the text of a custom notification message entered by the user.
  const [customMessage, setCustomMessage] = useState("");
  // State variable to track whether the user is in custom message mode.
  const [isCustomMessageMode, setIsCustomMessageMode] = useState(false);
  // State variable to store an array of guest notifications fetched from Firebase.
  const [notifications, setNotifications] = useState([]);

  // useEffect hook to handle side effects like setting up Firebase authentication listener and fetching initial notifications.
  useEffect(() => {
    // Create a reference to the 'guestNotifications' collection in the Firestore database.
    const notificationsColRef = collection(db, "guestNotifications");
    // Create a query to fetch notifications ordered by the 'timestamp' field in descending order (newest first).
    const q = query(notificationsColRef, orderBy("timestamp", "desc"));

    // Set up a real-time listener for the 'guestNotifications' collection based on the query.
    const unsubscribeNotifications = onSnapshot(
      q,
      (querySnapshot) => {
        // When the snapshot updates (data changes), map over the documents to create an array of notification objects.
        const notificationList = querySnapshot.docs.map((doc) => ({
          id: doc.id, // Include the document ID in the notification object.
          ...doc.data(), // Include all other data from the document.
        }));
        // Update the 'notifications' state with the new list of notifications.
        setNotifications(notificationList);
      },
      (error) => {
        // If an error occurs while listening for notifications, log it to the console.
        console.error("Error listening for guest notifications: ", error);
        // Optionally, you could set an error state here to display a message to the user.
      }
    );

    // Return a cleanup function that will be executed when the component unmounts or before the effect runs again.
    return () => {
      // Unsubscribe from the real-time notifications listener.
      unsubscribeNotifications();
    };
  }, []); // The empty dependency array ensures this effect runs only once after the initial render.

  // Function to handle clicks on action buttons (ARRIVING, ARRIVED, DEPARTING).
  const handleActionClick = (selectedAction) => {
    // Only update the action if not in custom message mode.
    if (!isCustomMessageMode) {
      // Update the 'action' state with the selected action.
      setAction(selectedAction);
      // Update the preview message based on the new action and the current direction.
      updatePreview(selectedAction, direction);
    }
  };

  // Function to handle clicks on direction buttons (SHORESIDE, SHIPSIDE).
  const handleDirectionClick = (selectedDirection) => {
    // Only update the direction if not in custom message mode.
    if (!isCustomMessageMode) {
      // Update the 'direction' state with the selected direction.
      setDirection(selectedDirection);
      // Update the preview message based on the current action and the new direction.
      updatePreview(action, selectedDirection);
    }
  };

  // Function to update the preview message based on the selected action and direction.
  const updatePreview = (currentAction, currentDirection) => {
    // Check if both an action and a direction have been selected.
    if (currentAction && currentDirection) {
      let locationText = currentDirection;

      if (currentDirection === "SHORESIDE") {
        locationText = "the pier";
      } else if (currentDirection === "SHIPSIDE") {
        locationText = "ILMA";
      }

      let preview = "";
      if (currentAction === "ARRIVING") {
        preview = `A tender is arriving ${
          currentDirection === "SHIPSIDE" ? "" : "at"
        } ${locationText} in less than 5 minutes.`;
      } else if (currentAction === "ARRIVED") {
        preview = `A tender has arrived ${
          currentDirection === "SHIPSIDE" ? "" : "at"
        } ${locationText}.`;
      } else if (currentAction === "DEPARTING") {
        preview = `A tender is departing from ${locationText} in less than 5 minutes.`;
      } else {
        preview = `A tender is ${currentAction} ${locationText}.`;
      }
      setPreviewMessage(preview);
    } else {
      setPreviewMessage("");
    }
  };

  // Asynchronous function to handle sending a new notification to Firebase.
  const handleSendNotification = async () => {
    try {
      let formattedMessage = "";
      if (isCustomMessageMode && customMessage.trim() !== "") {
        formattedMessage = customMessage;
      } else if (action && direction) {
        let locationText = direction;
        let arrivalPreposition = "at";
        let arrivalLocation = locationText;
        let departurePreposition = "from";
        let departureLocation = locationText;

        if (direction === "SHORESIDE") {
          arrivalLocation = "the pier";
          departureLocation = "the pier";
        } else if (direction === "SHIPSIDE") {
          arrivalPreposition = "";
          arrivalLocation = "to ILMA";
          departureLocation = "ILMA";
        }

        if (action === "ARRIVING") {
          formattedMessage = `A tender is arriving ${arrivalPreposition} ${arrivalLocation} in less than 5 minutes.`;
        } else if (action === "ARRIVED") {
          formattedMessage = `A tender has arrived ${arrivalPreposition} ${arrivalLocation}.`;
        } else if (action === "DEPARTING") {
          formattedMessage = `A tender is departing ${departurePreposition} ${departureLocation} in less than 5 minutes.`;
        } else {
          formattedMessage = `A tender is ${action} ${locationText}.`;
        }
      }

      if (formattedMessage) {
        await addDoc(collection(db, "guestNotifications"), {
          message: formattedMessage,
          action: action,
          direction: direction, // Still store the raw direction
          timestamp: serverTimestamp(),
        });

        setAction("");
        setDirection("");
        setPreviewMessage("");
        setCustomMessage("");
        setIsCustomMessageMode(false);
      } else {
        alert(
          "Please select an action and a direction or enable custom message and enter a message before sending."
        );
      }
    } catch (error) {
      console.error("Error sending notification: ", error);
    }
  };

  // Asynchronous function to handle deleting a specific notification.
  const handleDeleteNotification = async (id) => {
    // Check if the user is logged in and confirm the deletion with the user.
    if (window.confirm("Are you sure you want to delete this notification?")) {
      try {
        // Delete the document with the given ID from the 'guestNotifications' collection.
        await deleteDoc(doc(db, "guestNotifications", id));
        // Update the local 'notifications' state by filtering out the deleted notification.
        setNotifications(
          notifications.filter((notification) => notification.id !== id)
        );
      } catch (err) {
        // If an error occurs during deletion, log it and display an alert.
        console.error("Error deleting notification:", err);
        alert("Failed to delete notification.");
      }
    }
  };

  // Asynchronous function to handle clearing all notifications.
  const handleClearNotifications = async () => {
    // Check if the user is logged in and get confirmation from the user before proceeding.
    if (
      window.confirm(
        "Are you sure you want to clear all notifications? This cannot be undone."
      )
    ) {
      try {
        // Retrieve all documents from the 'guestNotifications' collection.
        const querySnapshot = await getDocs(
          collection(db, "guestNotifications")
        );
        // Iterate over each document in the snapshot and delete it.
        querySnapshot.docs.forEach(async (document) => {
          await deleteDoc(doc(db, "guestNotifications", document.id));
        });
        // Clear the local 'notifications' state.
        setNotifications([]);
      } catch (error) {
        // If an error occurs during clearing, log it to the console.
        console.error("Error clearing notifications: ", error);
      }
    }
  };

  // Function to handle toggling the custom message mode.
  const handleCustomMessageButtonClick = () => {
    // Toggle the 'isCustomMessageMode' state.
    setIsCustomMessageMode(!isCustomMessageMode);
    // If entering custom message mode, clear the selected action, direction, and preview.
    if (!isCustomMessageMode) {
      setAction("");
      setDirection("");
      setPreviewMessage("");
    }
    // If exiting custom message mode, clear the custom message input.
    if (isCustomMessageMode) {
      setCustomMessage("");
    }
  };

  // useEffect hook to clear action and direction when a custom message is entered and custom mode is enabled.
  useEffect(() => {
    if (isCustomMessageMode && customMessage.trim() !== "") {
      setAction("");
      setDirection("");
      setPreviewMessage("");
    }
  }, [customMessage, isCustomMessageMode]); // This effect runs when 'customMessage' or 'isCustomMessageMode' changes.

  // Conditional rendering: display a loading message while the authentication state is being determined.

  // Conditional rendering: if the user is not logged in, display the login screen.

  return (
    <div className="radio-operator-dashboard">
      <Logo />
      <button onClick={handleSignOut} className="Btn btn-signout">
        <div className="sign">
          <svg viewBox="0 0 512 512">
            <path d="M377.9 105.9L500.7 228.7c7.2 7.2 11.3 17.1 11.3 27.3s-4.1 20.1-11.3 27.3L377.9 406.1c-6.4 6.4-15 9.9-24 9.9c-18.7 0-33.9-15.2-33.9-33.9l0-62.1-128 0c-17.7 0-32-14.3-32-32l0-64c0-17.7 14.3-32 32-32l128 0 0-62.1c0-18.7 15.2-33.9 33.9-33.9c9 0 17.6 3.6 24 9.9zM160 96L96 96c-17.7 0-32 14.3-32 32l0 256c0 17.7 14.3 32 32 32l64 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-64 0c-53 0-96-43-96-96L0 128C0 75 43 32 96 32l64 0c17.7 0 32 14.3 32 32s-14.3 32-32 32z"></path>
          </svg>
        </div>
      </button>
      <Link
        to="/analytics"
        className="Btn analytics-button"
        aria-label="View Analytics"
      >
        <div className="sign">
          <svg
            fill="#000000"
            height="800px"
            width="800px"
            version="1.1"
            id="Layer_1"
            viewBox="0 0 512.011 512.011"
          >
            <g>
              <g>
                <g>
                  <path d="M192,64.005c-58.907,0-106.667,47.759-106.667,106.667S133.093,277.339,192,277.339s106.667-47.759,106.667-106.667     S250.907,64.005,192,64.005z M239.54,127.834c0.241,0.267,0.47,0.545,0.707,0.816c0.494,0.567,0.984,1.137,1.458,1.721     c0.268,0.33,0.526,0.667,0.787,1.002c0.425,0.546,0.845,1.096,1.253,1.656c0.262,0.359,0.518,0.721,0.772,1.086     c0.391,0.561,0.772,1.129,1.146,1.703c0.24,0.368,0.479,0.737,0.712,1.11c0.377,0.606,0.739,1.222,1.095,1.841     c0.203,0.352,0.411,0.701,0.608,1.057c0.405,0.735,0.789,1.483,1.166,2.235c0.125,0.25,0.261,0.495,0.383,0.747     c0.489,1.009,0.952,2.032,1.388,3.069c0.105,0.249,0.196,0.505,0.298,0.756c0.322,0.794,0.635,1.592,0.926,2.401     c0.036,0.101,0.067,0.203,0.103,0.304h-39.01v-39.01c0.101,0.036,0.203,0.067,0.304,0.103c0.809,0.291,1.608,0.604,2.402,0.927     c0.251,0.102,0.507,0.193,0.756,0.298c1.037,0.436,2.061,0.9,3.07,1.388c0.251,0.122,0.495,0.256,0.744,0.381     c0.753,0.377,1.502,0.762,2.238,1.168c0.356,0.196,0.705,0.405,1.057,0.608c0.619,0.357,1.235,0.719,1.841,1.095     c0.373,0.232,0.741,0.472,1.11,0.711c0.574,0.374,1.143,0.755,1.704,1.147c0.364,0.254,0.726,0.51,1.084,0.771     c0.561,0.409,1.112,0.829,1.659,1.255c0.334,0.261,0.671,0.519,1,0.786c0.585,0.475,1.156,0.965,1.723,1.459     c0.271,0.236,0.548,0.465,0.815,0.706C236.485,124.617,238.055,126.187,239.54,127.834z M192,234.672c-35.343,0-64-28.657-64-64     c0-27.861,17.813-51.555,42.667-60.343v60.343c0,11.782,9.551,21.333,21.333,21.333h60.343     C243.555,216.859,219.861,234.672,192,234.672z" />
                  <path d="M405.333,85.339h-64c-11.782,0-21.333,9.551-21.333,21.333c0,11.782,9.551,21.333,21.333,21.333h64     c11.782,0,21.333-9.551,21.333-21.333C426.667,94.89,417.115,85.339,405.333,85.339z" />
                  <path d="M405.333,213.339H320c-11.782,0-21.333,9.551-21.333,21.333c0,11.782,9.551,21.333,21.333,21.333h85.333     c11.782,0,21.333-9.551,21.333-21.333C426.667,222.89,417.115,213.339,405.333,213.339z" />
                  <path d="M405.333,149.339h-42.667c-11.782,0-21.333,9.551-21.333,21.333c0,11.782,9.551,21.333,21.333,21.333h42.667     c11.782,0,21.333-9.551,21.333-21.333C426.667,158.89,417.115,149.339,405.333,149.339z" />
                  <path d="M512,319.794V59.547c0-32.881-26.661-59.541-59.541-59.541H59.541C26.661,0.005,0,26.666,0,59.547v260.459     c0,0.071,0.01,0.14,0.011,0.211v46.914c0,32.881,26.64,59.541,59.52,59.541h105.146l-10.667,42.667h-4.677     c-11.782,0-21.333,9.551-21.333,21.333s9.551,21.333,21.333,21.333h21.333h170.667h21.333c11.782,0,21.333-9.551,21.333-21.333     s-9.551-21.333-21.333-21.333h-4.677l-10.667-42.667h105.146c32.881,0,59.541-26.661,59.541-59.541v-47.125     C512.011,319.934,512.001,319.865,512,319.794z M42.667,59.547c0-9.317,7.558-16.875,16.875-16.875h392.917     c9.317,0,16.875,7.558,16.875,16.875v239.125H42.667V59.547z M314.01,469.339H197.99l10.667-42.667h94.687L314.01,469.339z      M469.344,367.131c0,9.317-7.558,16.875-16.875,16.875H320H192H59.531c-9.309,0-16.853-7.55-16.853-16.875v-25.792h426.667     V367.131z" />
                </g>
              </g>
            </g>
          </svg>
        </div>
      </Link>
      <h2>TENDER STATUS</h2>
      <p>Select Action:</p>
      <div>
        <div className="action-buttons-container">
          <button
            key="arriving"
            onClick={() => handleActionClick("ARRIVING")}
            className={`action-button ${
              isCustomMessageMode ? "action-button-disabled" : ""
            } ${action === "ARRIVING" ? "action-button-selected" : ""}`}
            // Disable the button if in custom message mode
          >
            ARRIVING
          </button>
          <button
            key="arrived"
            onClick={() => handleActionClick("ARRIVED")}
            className={`action-button ${
              isCustomMessageMode ? "action-button-disabled" : ""
            }  ${action === "ARRIVED" ? "action-button-selected" : ""}`}
          >
            ARRIVED
          </button>
          <button
            key="departing"
            onClick={() => handleActionClick("DEPARTING")}
            className={`action-button ${
              isCustomMessageMode ? "action-button-disabled" : ""
            }  ${action === "DEPARTING" ? "action-button-selected" : ""}`}
          >
            DEPARTING
          </button>
        </div>
      </div>
      <p>Select Location:</p>
      <div>
        <div className="direction-buttons-container">
          <button
            key="shoreside"
            onClick={() => handleDirectionClick("SHORESIDE")}
            className={`direction-button ${
              isCustomMessageMode ? "action-button-disabled" : ""
            }  ${direction === "SHORESIDE" ? "direction-button-selected" : ""}`}
          >
            SHORESIDE
          </button>
          <button
            key="shipside"
            onClick={() => handleDirectionClick("SHIPSIDE")}
            className={`direction-button ${
              isCustomMessageMode ? "action-button-disabled" : ""
            }  ${direction === "SHIPSIDE" ? "direction-button-selected" : ""}`}
          >
            SHIPSIDE
          </button>
        </div>
      </div>
      <p>Custom message notification:</p>
      <div className="direction-buttons-container">
        <button
          onClick={handleCustomMessageButtonClick}
          className={`direction-button ${
            isCustomMessageMode ? "custom-message-button-selected" : ""
          }`}
        >
          {isCustomMessageMode
            ? "CUSTOM MESSAGE ENABLED"
            : "CUSTOM MESSAGE DISABLED"}
        </button>
      </div>
      <p>Preview Message:</p>
      {isCustomMessageMode ? (
        <textarea
          value={customMessage}
          onChange={(e) => setCustomMessage(e.target.value)}
          placeholder="Enter your custom message here..."
          className="preview-message"
        />
      ) : (
        <div>
          <div className="preview-message">{previewMessage}</div>
        </div>
      )}
      <div className="button-container">
        <button
          disabled={
            !(
              (action && direction) ||
              (customMessage && customMessage.trim() !== "")
            )
          }
          onClick={handleSendNotification}
          className="send-notification-button"
        >
          Send Notification
        </button>
        <button
          onClick={handleClearNotifications}
          className="clear-notifications-button"
        >
          Clear All Notifications
        </button>
      </div>
      <p>Guest Notifications</p>
      {notifications.length > 0 ? (
        <ul className="guest-notifications-list-operator">
          {notifications.map((notification) => (
            <li key={notification.id} className="notification-item-operator">
              <div className="notification-content-operator">
                <p>{notification.message}</p>
                {notification.timestamp && (
                  <small>
                    {notification.timestamp
                      ?.toDate()
                      ?.toLocaleString(undefined, {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "numeric",
                        minute: "numeric",
                        hour12: true,
                      })}
                  </small>
                )}
              </div>
              <button
                onClick={() => handleDeleteNotification(notification.id)}
                className="delete-notification-button"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <small>No guest notifications yet.</small>
      )}
    </div>
  );
}

export default RadioOperatorDashboard;
