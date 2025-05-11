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
  limit, // Add this import
  setDoc,
  updateDoc,
  getDoc,
  writeBatch,
} from "firebase/firestore";
// Import the CSS file for styling this component.
import "./RadioOperatorDashboard.css";
// Import the Logo component, presumably for displaying a logo.
import Logo from "../../components/logo";

import { Link } from "react-router-dom";
import SettingsIcon from "../../assets/settings.png";

// Define the main functional component for the Radio Operator Dashboard.
function RadioOperatorDashboard() {
  // State variable to store the selected action (e.g., 'ARRIVING', 'ARRIVED', 'DEPARTED').
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
  // Add a new state variable to track the selected tender
  const [selectedTender, setSelectedTender] = useState("");
  const [newPortDay, setNewPortDay] = useState({ name: "" }); // Remove startDate from state
  const [portDays, setPortDays] = useState([]);
  const [activePortDay, setActivePortDay] = useState(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // useEffect hook to handle side effects like setting up Firebase authentication listener and fetching initial notifications.
  useEffect(() => {
    const notificationsColRef = collection(db, "guestNotifications");
    // Add limit(10) to your query
    const q = query(
      notificationsColRef,
      orderBy("timestamp", "desc"),
      limit(10)
    );

    const unsubscribeNotifications = onSnapshot(q, (querySnapshot) => {
      const notificationList = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setNotifications(notificationList);
    }, (error) => {
      console.error("Error listening for guest notifications: ", error);
    });

    return () => unsubscribeNotifications();
  }, []); // The empty dependency array ensures this effect runs only once after the initial render.

  // Fetch port days and set only the active one in UI
  useEffect(() => {
    const fetchPortDays = async () => {
      const snapshot = await getDocs(collection(db, "portDays"));
      const allPortDays = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Only one can be active: if more than one, pick the most recent by startDate
      const actives = allPortDays.filter(pd => pd.isActive);
      let active = null;
      if (actives.length > 1) {
        // Deactivate all but the most recent
        const sorted = actives
          .map(pd => ({
            ...pd,
            startDate: pd.startDate?.seconds
              ? new Date(pd.startDate.seconds * 1000)
              : new Date(pd.startDate),
          }))
          .sort((a, b) => b.startDate - a.startDate);
        active = sorted[0];
        // Deactivate others in DB
        for (let i = 1; i < sorted.length; i++) {
          await updateDoc(doc(db, "portDays", sorted[i].id), { isActive: false });
        }
      } else {
        active = actives[0] || null;
      }
      setActivePortDay(active || null);
      setPortDays(allPortDays);
    };
    fetchPortDays();
  }, []);

  // Function to handle clicks on action buttons (ARRIVING, ARRIVED, DEPARTED).
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

  // Function to handle clicks on tender buttons
  const handleTenderClick = (tenderNumber) => {
    // Only update the tender if not in custom message mode
    if (!isCustomMessageMode) {
      setSelectedTender(tenderNumber);
      // Update the preview message with the new tender selection
      updatePreview(action, direction, tenderNumber);
    }
  };

  // Function to update the preview message based on the selected action and direction.
  const updatePreview = (currentAction, currentDirection, currentTender = selectedTender) => {
    // Check if both an action and a direction have been selected
    if (currentAction && currentDirection) {
      let locationText = currentDirection;

      if (currentDirection === "SHORESIDE") {
        locationText = "the pier";
      } else if (currentDirection === "SHIPSIDE") {
        locationText = "Evrima";
      }

      let preview = "";
      const tenderPrefix = currentTender ? `${currentTender} ` : "A tender ";

      if (currentAction === "ARRIVING") {
        preview = `${tenderPrefix}is arriving ${currentDirection === "SHIPSIDE" ? "" : "at"
          } ${locationText} in less than 5 minutes.`;
      } else if (currentAction === "ARRIVED") {
        preview = `${tenderPrefix}has arrived ${currentDirection === "SHIPSIDE" ? "" : "at"
          } ${locationText}.`;
      } else if (currentAction === "DEPARTED") {
        preview = `${tenderPrefix}has departed from ${locationText}.`;
      } else {
        preview = `${tenderPrefix}is ${currentAction} ${locationText}.`;
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
          arrivalLocation = "to Evrima";
          departureLocation = "Evrima";
        }

        const tenderPrefix = selectedTender ? `${selectedTender} ` : "A tender ";

        if (action === "ARRIVING") {
          formattedMessage = `${tenderPrefix}is arriving ${arrivalPreposition} ${arrivalLocation} in less than 5 minutes.`;
        } else if (action === "ARRIVED") {
          formattedMessage = `${tenderPrefix}has arrived ${arrivalPreposition} ${arrivalLocation}.`;
        } else if (action === "DEPARTED") {
          formattedMessage = `${tenderPrefix}has departed ${departurePreposition} ${departureLocation}.`;
        } else {
          formattedMessage = `${tenderPrefix}is ${action} ${locationText}.`;
        }
      }

      if (formattedMessage && activePortDay?.id) {
        await addDoc(collection(db, "guestNotifications"), {
          message: formattedMessage,
          action: action,
          direction: direction,
          tender: selectedTender, // Store the tender information
          timestamp: serverTimestamp(),
          portDayId: activePortDay.id, // <-- associate with port day
        });

        setAction("");
        setDirection("");
        setSelectedTender(""); // Reset the selected tender
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
    if (window.confirm("Are you sure you want to delete this notification?")) {
      try {
        // Just delete from Firestore and let onSnapshot handle the state update
        await deleteDoc(doc(db, "guestNotifications", id));
      } catch (err) {
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

  // Create new port day, set as active, and update UI (deactivate all others in DB)
  const handleCreatePortDay = async () => {
    if (!newPortDay.name) return;

    // Confirmation dialog requiring user to type 'PORT'
    const confirmation = window.prompt(
      "To confirm creation of a new port day, please type PORT and press OK."
    );
    if (confirmation !== "PORT") {
      alert("Port day creation cancelled. You must type PORT to confirm.");
      return;
    }

    // Deactivate all port days in DB
    const snapshot = await getDocs(collection(db, "portDays"));
    const batch = writeBatch(db);
    snapshot.docs.forEach(docSnap => {
      batch.update(doc(db, "portDays", docSnap.id), { isActive: false });
    });

    // Use current date/time for startDate
    const now = new Date();
    const docRef = await addDoc(collection(db, "portDays"), {
      name: newPortDay.name,
      isActive: true,
      startDate: now,
    });
    await batch.commit();

    setActivePortDay({
      id: docRef.id,
      name: newPortDay.name,
      isActive: true,
      startDate: now,
    });
    setNewPortDay({ name: "" });
  };

  // Delete the active port day from UI AND from DB
  const handleDeleteActivePortDayFromUI = async () => {
    if (activePortDay && window.confirm("Are you sure you want to delete this port day?")) {
      await deleteDoc(doc(db, "portDays", activePortDay.id));
      setActivePortDay(null);
    }
  };

  // Function to handle toggling the custom message mode.
  const handleCustomMessageButtonClick = () => {
    setIsCustomMessageMode(!isCustomMessageMode);
    if (!isCustomMessageMode) {
      setAction("");
      setDirection("");
      setSelectedTender(""); // Clear the selected tender
      setPreviewMessage("");
    }
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

      {/* Settings Button */}
      <button
        className="Btn analytics-button"
        onClick={() => setShowSettingsModal(true)}
        type="button"
      >
        <div className="sign">
          <img src={SettingsIcon} alt="Settings" />
        </div>
      </button>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
          >
            <button
              className="modal-close-btn"
              onClick={() => setShowSettingsModal(false)}
              title="Close"
            >
              ×
            </button>
            <h3>Port Day Management</h3>
            <div className="port-day-management">
              <div className="create">
                <input
                  type="text"
                  placeholder="Port Day Name"
                  value={newPortDay.name}
                  onChange={e => setNewPortDay({ name: e.target.value })}
                />
                <button
                  onClick={handleCreatePortDay}
                  disabled={!newPortDay.name || newPortDay.name.trim() === ""}
                >
                  Create
                </button>
              </div>
              <ul>
                {activePortDay ? (
                  <li className="active">
                    <span>
                      {activePortDay.name}
                      {activePortDay.startDate && (
                        <span style={{ marginLeft: 10, color: "#aaa", fontSize: "0.9em" }}>
                          {new Date(activePortDay.startDate.seconds
                            ? activePortDay.startDate.seconds * 1000
                            : activePortDay.startDate
                          ).toLocaleString("en-GB", { year: "numeric", month: "2-digit", day: "2-digit" })}
                        </span>
                      )}
                    </span>
                  </li>
                ) : (
                  <li style={{ opacity: 0.6, color: "#aaa" }}>No active port day</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      <h2>TENDER STATUS</h2>
      <p>Select Tender:</p>
      <div>
        <div className="action-buttons-container">
          <button
            key="tender1"
            onClick={() => handleTenderClick("Tender 1")}
            className={`action-button ${isCustomMessageMode ? "action-button-disabled" : ""
              } ${selectedTender === "Tender 1" ? "action-button-selected" : ""}`}
          >
            TENDER 1
          </button>
          <button
            key="tender2"
            onClick={() => handleTenderClick("Tender 2")}
            className={`action-button ${isCustomMessageMode ? "action-button-disabled" : ""
              } ${selectedTender === "Tender 2" ? "action-button-selected" : ""}`}
          >
            TENDER 2
          </button>
          <button
            key="tender3"
            onClick={() => handleTenderClick("Tender 3")}
            className={`action-button ${isCustomMessageMode ? "action-button-disabled" : ""
              } ${selectedTender === "Tender 3" ? "action-button-selected" : ""}`}
          >
            TENDER 3
          </button>
          <button
            key="tender4"
            onClick={() => handleTenderClick("Tender 4")}
            className={`action-button ${isCustomMessageMode ? "action-button-disabled" : ""
              } ${selectedTender === "Tender 4" ? "action-button-selected" : ""}`}
          >
            TENDER 4
          </button>
          <button
            key="tender5"
            onClick={() => handleTenderClick("Tender 5")}
            className={`action-button ${isCustomMessageMode ? "action-button-disabled" : ""
              } ${selectedTender === "Tender 5" ? "action-button-selected" : ""}`}
          >
            TENDER 5
          </button>

        </div>
      </div>
      <p>Select Action:</p>
      <div>
        <div className="action-buttons-container">
          {/* <button
            key="arriving"
            onClick={() => handleActionClick("ARRIVING")}
            className={`action-button ${isCustomMessageMode ? "action-button-disabled" : ""
              } ${action === "ARRIVING" ? "action-button-selected" : ""}`}
          // Disable the button if in custom message mode
          >
            ARRIVING
          </button> */}
          <button
            key="arrived"
            onClick={() => handleActionClick("ARRIVED")}
            className={`action-button ${isCustomMessageMode ? "action-button-disabled" : ""
              }  ${action === "ARRIVED" ? "action-button-selected" : ""}`}
          >
            ARRIVED
          </button>
          <button
            key="departed"
            onClick={() => handleActionClick("DEPARTED")}
            className={`action-button ${isCustomMessageMode ? "action-button-disabled" : ""
              }  ${action === "DEPARTED" ? "action-button-selected" : ""}`}
          >
            DEPARTED
          </button>
        </div>
      </div>
      <p>Select Location:</p>
      <div>
        <div className="direction-buttons-container">
          <button
            key="shoreside"
            onClick={() => handleDirectionClick("SHORESIDE")}
            className={`direction-button ${isCustomMessageMode ? "action-button-disabled" : ""
              }  ${direction === "SHORESIDE" ? "direction-button-selected" : ""}`}
          >
            SHORESIDE
          </button>
          <button
            key="shipside"
            onClick={() => handleDirectionClick("SHIPSIDE")}
            className={`direction-button ${isCustomMessageMode ? "action-button-disabled" : ""
              }  ${direction === "SHIPSIDE" ? "direction-button-selected" : ""}`}
          >
            SHIPSIDE
          </button>
        </div>
      </div>
      {/* Add this after the direction buttons section */}

      <p>Custom message notification:</p>
      <div className="direction-buttons-container">
        <button
          onClick={handleCustomMessageButtonClick}
          className={`direction-button ${isCustomMessageMode ? "custom-message-button-selected" : ""
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
        {/* <button
          onClick={handleClearNotifications}
          className="clear-notifications-button"
        >
          Clear All Notifications
        </button> */}
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
