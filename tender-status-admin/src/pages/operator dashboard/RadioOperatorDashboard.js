import React, { useState, useEffect, useRef } from "react";
import { db, handleSignOut } from "../../firebase/firebaseconfig";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  writeBatch,
  limit
} from "firebase/firestore";
import "./RadioOperatorDashboard.css";
import Logo from "../../components/logo";
import Location from "../../assets/location.png";
import Clock from "../../assets/clock.png";
import SettingsIcon from "../../assets/settings.png";
import PierLocationMap from "../../components/PierLocationMap";

function RadioOperatorDashboard() {
  // Notification and tender state
  const [action, setAction] = useState("");
  const [direction, setDirection] = useState("");
  const [previewMessage, setPreviewMessage] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [isCustomMessageMode, setIsCustomMessageMode] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [selectedTender, setSelectedTender] = useState("");

  // Port day state
  const [activePortDay, setActivePortDay] = useState(null);
  const [portDays, setPortDays] = useState([]);
  const [isConfigLoading, setIsConfigLoading] = useState(true); // <-- Add loading state

  // Configuration diagram state
  const [isCreatingConfig, setIsCreatingConfig] = useState(false);
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [configData, setConfigData] = useState({
    name: "",
    avgTime: "",
    pierLocation: null,
    lastTenderTime: "",
    timezone: "",
  });
  const [showMap, setShowMap] = useState(false);

  // Settings modal (only for settings, not port day management)
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const portNameRef = useRef(null);

  // Fetch notifications
  useEffect(() => {
    const notificationsColRef = collection(db, "guestNotifications");
    const q = query(
      notificationsColRef,
      orderBy("timestamp", "desc"),
      limit(10) // <-- Limit to 10 notifications
    );
    const unsubscribeNotifications = onSnapshot(q, (querySnapshot) => {
      const notificationList = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setNotifications(notificationList);
    });
    return () => unsubscribeNotifications();
  }, []);

  // Fetch port days and set only the active one in UI
  useEffect(() => {
    const fetchPortDays = async () => {
      setIsConfigLoading(true); // <-- Start loading
      const snapshot = await getDocs(collection(db, "portDays"));
      const allPortDays = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const actives = allPortDays.filter(pd => pd.isActive);
      let active = null;
      if (actives.length > 1) {
        const sorted = actives
          .map(pd => ({
            ...pd,
            startDate: pd.startDate?.seconds
              ? new Date(pd.startDate.seconds * 1000)
              : new Date(pd.startDate),
          }))
          .sort((a, b) => b.startDate - a.startDate);
        active = sorted[0];
        for (let i = 1; i < sorted.length; i++) {
          await updateDoc(doc(db, "portDays", sorted[i].id), { isActive: false });
        }
      } else {
        active = actives[0] || null;
      }
      setActivePortDay(active || null);
      setPortDays(allPortDays);
      setIsConfigLoading(false); // <-- End loading
    };
    fetchPortDays();
  }, []);

  // Notification preview logic
  const updatePreview = (currentAction, currentDirection, currentTender = selectedTender) => {
    if (currentAction && currentDirection) {
      let locationText = currentDirection;
      if (currentDirection === "SHORESIDE") locationText = "the pier";
      else if (currentDirection === "SHIPSIDE") locationText = "Evrima";
      let preview = "";
      const tenderPrefix = currentTender ? `${currentTender} ` : "A tender ";
      if (currentAction === "ARRIVING") {
        preview = `${tenderPrefix}is arriving ${currentDirection === "SHIPSIDE" ? "" : "at"} ${locationText} in less than 5 minutes.`;
      } else if (currentAction === "ARRIVED") {
        preview = `${tenderPrefix}has arrived ${currentDirection === "SHIPSIDE" ? "" : "at"} ${locationText}.`;
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

  // Notification actions
  const handleActionClick = (selectedAction) => {
    if (!isCustomMessageMode) {
      setAction(selectedAction);
      updatePreview(selectedAction, direction);
    }
  };
  const handleDirectionClick = (selectedDirection) => {
    if (!isCustomMessageMode) {
      setDirection(selectedDirection);
      updatePreview(action, selectedDirection);
    }
  };
  const handleTenderClick = (tenderNumber) => {
    if (!isCustomMessageMode) {
      setSelectedTender(tenderNumber);
      updatePreview(action, direction, tenderNumber);
    }
  };

  // Send notification
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
        // Get actual UTC time, then add the port's timezone offset
        const now = new Date();
        const utcTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000));
        const timezoneOffset = activePortDay.timezone ? parseFloat(activePortDay.timezone) : 0;
        const localTimestamp = new Date(utcTime.getTime() + (timezoneOffset * 60 * 60 * 1000));

        await addDoc(collection(db, "guestNotifications"), {
          message: formattedMessage,
          action: action,
          direction: direction,
          tender: selectedTender,
          timestamp: localTimestamp, // Store the port's local time
          portDayId: activePortDay.id,
        });
        setAction("");
        setDirection("");
        setSelectedTender("");
        setPreviewMessage("");
        setCustomMessage("");
        setIsCustomMessageMode(false);
      } else {
        alert("Please check port day information is set, select an action and a direction or enable custom message and enter a message before sending.");
      }
    } catch (error) {
      console.error("Error sending notification: ", error);
    }
  };

  // Delete notification
  const handleDeleteNotification = async (id) => {
    if (window.confirm("Are you sure you want to delete this notification?")) {
      try {
        await deleteDoc(doc(db, "guestNotifications", id));
      } catch (err) {
        console.error("Error deleting notification:", err);
        alert("Failed to delete notification.");
      }
    }
  };

  // Custom message mode toggle
  const handleCustomMessageButtonClick = () => {
    setIsCustomMessageMode(!isCustomMessageMode);
    if (!isCustomMessageMode) {
      setAction("");
      setDirection("");
      setSelectedTender("");
      setPreviewMessage("");
    }
    if (isCustomMessageMode) {
      setCustomMessage("");
    }
  };

  useEffect(() => {
    if (isCustomMessageMode && customMessage.trim() !== "") {
      setAction("");
      setDirection("");
      setPreviewMessage("");
    }
  }, [customMessage, isCustomMessageMode]);

  // --- Port Day CRUD in Diagram ---

  // Start create mode
  const handleStartCreateConfig = () => {
    setConfigData({
      name: "",
      avgTime: "",
      pierLocation: null,
      lastTenderTime: "",
      timezone: "",
    });
    setIsCreatingConfig(true);
    setIsEditingConfig(false);
  };


  // Start edit mode
  const handleStartEditConfig = () => {
    if (
      window.confirm(
        "Are you sure you want to edit the active port day configuration? Changes will affect all users."
      )
    ) {
      setConfigData({
        name: activePortDay.name || "",
        avgTime: activePortDay.avgTime || "",
        pierLocation: activePortDay.pierLocation || null,
        lastTenderTime: activePortDay.lastTenderTime || "",
        timezone: activePortDay.timezone || "",
      });
      setIsEditingConfig(true);
      setIsCreatingConfig(false);
    }
  };

  // Save new port day
  const handleSaveCreateConfig = async () => {
    if (!configData.name || !configData.avgTime || !configData.pierLocation) {
      alert("Please fill all fields and select a pier location.");
      return;
    }
    // Deactivate all port days in DB
    const snapshot = await getDocs(collection(db, "portDays"));
    const batch = writeBatch(db);
    snapshot.docs.forEach(docSnap => {
      batch.update(doc(db, "portDays", docSnap.id), { isActive: false });
    });
    const now = new Date();
    const plainPierLocation = configData.pierLocation
      ? { lat: configData.pierLocation.lat, lng: configData.pierLocation.lng }
      : null;
    const docRef = await addDoc(collection(db, "portDays"), {
      name: configData.name,
      isActive: true,
      startDate: now,
      pierLocation: plainPierLocation,
      avgTime: configData.avgTime,
      lastTenderTime: configData.lastTenderTime,
      timezone: configData.timezone,
    });
    await batch.commit();
    setActivePortDay({
      id: docRef.id,
      name: configData.name,
      isActive: true,
      startDate: now,
      pierLocation: configData.pierLocation,
      avgTime: configData.avgTime,
      lastTenderTime: configData.lastTenderTime,
      timezone: configData.timezone,
    });
    setIsCreatingConfig(false);
    setConfigData({ name: "", avgTime: "", pierLocation: null, lastTenderTime: "", timezone: "" });
  };

  // Save edit to active port day
  const handleSaveEditConfig = async () => {
    if (!activePortDay?.id || !configData.name || !configData.avgTime || !configData.pierLocation) {
      alert("Please fill all fields and select a pier location.");
      return;
    }
    const plainPierLocation = configData.pierLocation
      ? { lat: configData.pierLocation.lat, lng: configData.pierLocation.lng }
      : null;
    await updateDoc(doc(db, "portDays", activePortDay.id), {
      name: configData.name,
      avgTime: configData.avgTime,
      pierLocation: plainPierLocation,
      lastTenderTime: configData.lastTenderTime,
      timezone: configData.timezone,
    });
    setActivePortDay({
      ...activePortDay,
      name: configData.name,
      avgTime: configData.avgTime,
      pierLocation: configData.pierLocation,
      lastTenderTime: configData.lastTenderTime,
      timezone: configData.timezone,
    });
    setIsEditingConfig(false);
    setConfigData({ name: "", avgTime: "", pierLocation: null, lastTenderTime: "", timezone: "" });
  };

  // End (delete) active port day
  const handleDeleteActivePortDay = async () => {
    if (activePortDay && window.confirm("Are you sure you want to delete this port day?")) {
      await deleteDoc(doc(db, "portDays", activePortDay.id));
      setActivePortDay(null);
    }
  };

  // --- Configuration Diagram UI ---
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

      <h2>TENDER STATUS</h2>
      <div className="configuration-diagram">
        <h3>
          {isConfigLoading ? (
            "Loading data..."
          ) : isCreatingConfig ? (
            <div className="config-title">
              <textarea
                className="editable-field"
                placeholder="Port Name"
                value={configData.name}
                onChange={e =>
                  setConfigData(data => ({
                    ...data,
                    name: e.target.value,
                  }))
                }

                rows={1}
              />
              <textarea className="editable-field time-zone"
                placeholder="Time Zone"
                value={configData.timezone}
                onChange={e =>
                  setConfigData(data => ({
                    ...data,
                    timezone: e.target.value,
                  }))
                }

                rows={1}></textarea>
            </div>
          ) : activePortDay ? (
            activePortDay.name + (activePortDay.timezone ? ` (UTC ${activePortDay.timezone})` : "")
          ) : (
            "No active port day"
          )}
        </h3>
        <div className="configuration">
          {/* CREATE MODE */}
          {isCreatingConfig && (
            <>
              <div className="configuration-item">
                <img
                  src={Location}
                  alt="location-icon"
                  className="config-location-clickable"
                  onClick={() => setShowMap(true)}
                  style={{ cursor: "pointer" }}
                />
                <span className="configuration-value">
                  {configData.pierLocation
                    ? (
                      <>
                        Lat: {configData.pierLocation.lat.toFixed(2)}
                        <br />
                        Lng: {configData.pierLocation.lng.toFixed(2)}
                      </>
                    )
                    : "Not set"}
                </span>
              </div>
              <div className="configuration-item">
                <img src={Clock} alt="clock-icon" />
                <select
                  className="avg-ride-time-select"
                  value={configData.avgTime || ""}
                  onChange={e =>
                    setConfigData(data => ({
                      ...data,
                      avgTime: e.target.value,
                    }))
                  }
                >
                  <option value="">Avg Ride Time</option>
                  {[...Array(12)].map((_, i) => {
                    const min = (i + 1) * 5;
                    return (
                      <option key={min} value={min}>{min} min</option>
                    );
                  })}
                </select>
              </div>
              <div className="configuration-item">
                <label style={{ marginRight: 8 }}>Last Tender:</label>
                <input
                  type="time"
                  value={configData.lastTenderTime}
                  onChange={e =>
                    setConfigData(data => ({
                      ...data,
                      lastTenderTime: e.target.value,
                    }))
                  }
                  className="last-tender-time-input"
                  required
                />
              </div>
              <button
                className="save-port-btn"
                onClick={handleSaveCreateConfig}
              >
                Save
              </button>
              <button
                className="end-port"
                onClick={() => setIsCreatingConfig(false)}
              >
                Cancel
              </button>
            </>
          )}
          {/* EDIT MODE */}
          {isEditingConfig && (
            <>
              <div className="configuration-item">
                <img
                  src={Location}
                  alt="location-icon"
                  className="config-location-clickable"
                  onClick={() => setShowMap(true)}
                  style={{ cursor: "pointer" }}
                />
                <span className="configuration-value">
                  {configData.pierLocation
                    ? (
                      <>
                        Lat: {configData.pierLocation.lat.toFixed(2)}
                        <br />
                        Lng: {configData.pierLocation.lng.toFixed(2)}
                      </>
                    )
                    : "Not set"}
                </span>
              </div>
              <div className="configuration-item">
                <img src={Clock} alt="clock-icon" />
                <select
                  className="avg-ride-time-select"
                  value={configData.avgTime || ""}
                  onChange={e =>
                    setConfigData(data => ({
                      ...data,
                      avgTime: e.target.value,
                    }))
                  }
                >
                  <option value="">Avg Ride Time</option>
                  {[...Array(12)].map((_, i) => {
                    const min = (i + 1) * 5;
                    return (
                      <option key={min} value={min}>{min} min</option>
                    );
                  })}
                </select>
              </div>
              <div className="configuration-item">
                <label style={{ marginRight: 8 }}>Last Tender:</label>
                <input
                  type="time"
                  value={configData.lastTenderTime}
                  onChange={e =>
                    setConfigData(data => ({
                      ...data,
                      lastTenderTime: e.target.value,
                    }))
                  }
                  className="last-tender-time-input"
                  required
                />
              </div>
              <button
                className="save-port-btn"
                onClick={handleSaveEditConfig}
              >
                Save
              </button>
              <button
                className="end-port"
                onClick={() => setIsEditingConfig(false)}
              >
                Cancel
              </button>
            </>
          )}
          {/* DEFAULT MODE */}
          {!isCreatingConfig && !isEditingConfig && (
            <>
              {activePortDay ? (
                <>
                  <button className="edit-port" onClick={handleStartEditConfig}>
                    Edit Port
                  </button>
                  <button className="end-port" onClick={handleDeleteActivePortDay}>
                    End Day
                  </button>
                  <div className="configuration-item">
                    <img src={Location} alt="location-icon" />
                    <span className="configuration-value">
                      {activePortDay.pierLocation
                        ? (
                          <>
                            Lat: {activePortDay.pierLocation.lat.toFixed(2)}
                            <br />
                            Lng: {activePortDay.pierLocation.lng.toFixed(2)}
                          </>
                        )
                        : "Not set"}
                    </span>
                  </div>
                  <div className="configuration-item">
                    <img src={Clock} alt="location-icon" />
                    <span className="configuration-value">
                      {activePortDay.avgTime
                        ? `${activePortDay.avgTime} min`
                        : "Not set"}
                    </span>
                  </div>
                  <div className="configuration-item">
                    <span className="configuration-value">
                      Last Tender:{" "}
                      {activePortDay.lastTenderTime
                        ? activePortDay.lastTenderTime
                        : "Not set"}
                    </span>
                  </div>
                </>
              ) : (
                <button className="end-port" onClick={handleStartCreateConfig}>
                  Create
                </button>
              )}
            </>
          )}
        </div>
      </div>
      {/* Map modal for create/edit */}
      {(isCreatingConfig || isEditingConfig) && showMap && (
        <div className="modal-overlay">
          <div className="modal-content">
            <PierLocationMap
              initialPosition={configData.pierLocation}
              onSelect={loc => {
                setConfigData(data => ({
                  ...data,
                  pierLocation: loc,
                }));
                setShowMap(false);
              }}
              onChange={loc =>
                setConfigData(data => ({
                  ...data,
                  pierLocation: loc,
                }))
              }
              onClose={() => setShowMap(false)}
            />
            <button
              className="modal-close-button"
              onClick={() => setShowMap(false)}
            >
              X
            </button>
          </div>
        </div>
      )}
      {/* --- Rest of the dashboard UI (tender, action, direction, notifications) --- */}
      <p>Select Tender:</p>
      <div>
        <div className="action-buttons-container">
          {["Tender 1", "Tender 2", "Tender 3", "Tender 4", "Tender 5"].map(tender => (
            <button
              key={tender}
              onClick={() => handleTenderClick(tender)}
              className={`action-button ${isCustomMessageMode ? "action-button-disabled" : ""
                } ${selectedTender === tender ? "action-button-selected" : ""}`}
            >
              {tender.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <p>Select Action:</p>
      <div>
        <div className="action-buttons-container">
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
                    {(() => {
                      try {
                        // Since timestamp is already in local time, just format it
                        const localDate = notification.timestamp.toDate ?
                          notification.timestamp.toDate() :
                          new Date(notification.timestamp);

                        return localDate.toLocaleString(undefined, {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "numeric",
                          minute: "numeric",
                          hour12: true,
                        });
                      } catch (error) {
                        console.error('Error formatting timestamp:', error);
                        return 'Invalid date';
                      }
                    })()}
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
