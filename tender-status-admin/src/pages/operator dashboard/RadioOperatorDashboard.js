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
import ToastContainer from "../../components/ToastContainer";
import useToast from "../../hooks/useToast";

function RadioOperatorDashboard() {
  // Toast notifications
  const { toasts, removeToast, showSuccess, showError, showWarning } = useToast();

  // Notification and tender state
  const [action, setAction] = useState("");
  const [direction, setDirection] = useState("");
  const [previewMessage, setPreviewMessage] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [isCustomMessageMode, setIsCustomMessageMode] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [selectedTender, setSelectedTender] = useState("");
  const [isSending, setIsSending] = useState(false);

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
      orderBy("timestampSort", "desc"),
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
    // Prevent multiple sends
    if (isSending) {
      showWarning("Please wait, notification is being sent...");
      return;
    }

    try {
      setIsSending(true);
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

        // Format as string (e.g. "YYYY-MM-DD HH:mm")
        const localTimestampString = localTimestamp.toLocaleString(undefined, {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });

        await addDoc(collection(db, "guestNotifications"), {
          message: formattedMessage,
          action: action,
          direction: direction,
          tender: selectedTender,
          timestamp: localTimestampString, // Store as string
          timestampSort: localTimestamp, // Store as Firestore Timestamp for sorting
          portDayId: activePortDay.id,
        });

        // Success toast
        showSuccess("Notification sent successfully! Database updated.", 4000);

        // Reset form
        setAction("");
        setDirection("");
        setSelectedTender("");
        setPreviewMessage("");
        setCustomMessage("");
        setIsCustomMessageMode(false);
      } else {
        showError("Please check port day information is set, select an action and a direction or enable custom message and enter a message before sending.");
      }
    } catch (error) {
      console.error("Error sending notification: ", error);
      showError("Failed to send notification. Please check your connection and try again.");
    } finally {
      setIsSending(false);
    }
  };

  // Delete notification
  const handleDeleteNotification = async (id) => {
    if (window.confirm("Are you sure you want to delete this notification?")) {
      try {
        await deleteDoc(doc(db, "guestNotifications", id));
        showSuccess("Notification deleted successfully.");
      } catch (err) {
        console.error("Error deleting notification:", err);
        showError("Failed to delete notification. Please try again.");
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

  // Helper: validate UTC offset (integers or .5 only, -12 to +14)
  const isValidTimezone = (val) => {
    if (val === "" || val === null || val === undefined) return false;
    const num = Number(val);
    if (!isFinite(num)) return false;
    if (num < -12 || num > 14) return false;
    const fractional = Math.abs(num % 1);
    return fractional === 0 || fractional === 0.5;
  };

  // Display as "+x" when positive (e.g., "+6", "+5.5")
  const formatOffsetDisplay = (val) => {
    if (val === "" || val === null || val === undefined) return "";
    const num = Number(val);
    if (!isFinite(num)) return String(val);
    const rounded = Math.round(num * 2) / 2;
    const str = Number.isInteger(rounded) ? rounded.toFixed(0) : String(rounded);
    return rounded > 0 ? `+${str}` : str;
  };

  // Clamp to [-12, 14] and snap to .5
  const clampHalfStep = (num) => {
    if (!isFinite(num)) return NaN;
    let n = Math.round(num * 2) / 2;
    if (n < -12) n = -12;
    if (n > 14) n = 14;
    return n;
  };

  // Normalize any input string to the display format with sign and snapping
  const normalizeOffsetString = (val) => {
    const num = Number(val);
    if (!isFinite(num)) return String(val);
    const n = clampHalfStep(num);
    return formatOffsetDisplay(n);
  };

  // Save new port day
  const handleSaveCreateConfig = async () => {
    if (!configData.name || !configData.avgTime || !configData.pierLocation || !configData.timezone) {
      showError("Please fill all fields and select a pier location.");
      return;
    }
    if (!isValidTimezone(configData.timezone)) {
      showError("Time zone must be a numeric UTC offset between -12 and +14, using .5 if needed (e.g., -1, 2, 2.5).");
      return;
    }
    try {
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
        timezone: String(configData.timezone).trim(),
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
        timezone: String(configData.timezone).trim(),
      });
      setIsCreatingConfig(false);
      setConfigData({ name: "", avgTime: "", pierLocation: null, lastTenderTime: "", timezone: "" });
      showSuccess("Port day created successfully!");
    } catch (error) {
      console.error("Error creating port day:", error);
      showError("Failed to create port day. Please try again.");
    }
  };

  // Save edit to active port day
  const handleSaveEditConfig = async () => {
    if (!activePortDay?.id || !configData.name || !configData.avgTime || !configData.pierLocation || !configData.timezone) {
      showError("Please fill all fields and select a pier location.");
      return;
    }
    if (!isValidTimezone(configData.timezone)) {
      showError("Time zone must be a numeric UTC offset between -12 and +14, using .5 if needed (e.g., -1, 2, 2.5).");
      return;
    }
    try {
      const plainPierLocation = configData.pierLocation
        ? { lat: configData.pierLocation.lat, lng: configData.pierLocation.lng }
        : null;
      await updateDoc(doc(db, "portDays", activePortDay.id), {
        name: configData.name,
        avgTime: configData.avgTime,
        pierLocation: plainPierLocation,
        lastTenderTime: configData.lastTenderTime,
        timezone: String(configData.timezone).trim(),
      });
      setActivePortDay({
        ...activePortDay,
        name: configData.name,
        avgTime: configData.avgTime,
        pierLocation: configData.pierLocation,
        lastTenderTime: configData.lastTenderTime,
        timezone: String(configData.timezone).trim(),
      });
      setIsEditingConfig(false);
      setConfigData({ name: "", avgTime: "", pierLocation: null, lastTenderTime: "", timezone: "" });
      showSuccess("Port day updated successfully!");
    } catch (error) {
      console.error("Error updating port day:", error);
      showError("Failed to update port day. Please try again.");
    }
  };

  // End (delete) active port day
  const handleDeleteActivePortDay = async () => {
    if (activePortDay && window.confirm("Are you sure you want to delete this port day?")) {
      try {
        await deleteDoc(doc(db, "portDays", activePortDay.id));
        setActivePortDay(null);
        showSuccess("Port day deleted successfully!");
      } catch (error) {
        console.error("Error deleting port day:", error);
        showError("Failed to delete port day. Please try again.");
      }
    }
  };

  // Adjust timezone by +/- 0.5 within [-12, 14]
  const adjustTimezone = (delta) => {
    setConfigData(prev => {
      const current = prev.timezone === "" ? 0 : Number(prev.timezone);
      if (!isFinite(current)) return prev;
      const next = clampHalfStep(current + delta);
      return { ...prev, timezone: formatOffsetDisplay(next) };
    });
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
        <h3 className="config-header">
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
              {/* Timezone with large +/- controls */}
              <div className="timezone-control">
                <button
                  type="button"
                  className="tz-btn tz-minus"
                  onClick={() => adjustTimezone(-0.5)}
                  aria-label="Decrease timezone"
                >
                  −
                </button>
                <input
                  className="editable-field time-zone tz-input"
                  type="text"
                  inputMode="decimal"
                  placeholder="UTC"
                  value={configData.timezone}
                  onChange={e =>
                    setConfigData(data => ({
                      ...data,
                      timezone: e.target.value.trim(),
                    }))
                  }
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v === "") return;
                    setConfigData(data => ({
                      ...data,
                      timezone: normalizeOffsetString(v),
                    }));
                  }}
                  onWheel={(e) => e.currentTarget.blur()}
                />
                <button
                  type="button"
                  className="tz-btn tz-plus"
                  onClick={() => adjustTimezone(0.5)}
                  aria-label="Increase timezone"
                >
                  +
                </button>
              </div>
            </div>
          ) : isEditingConfig ? (
            <div className="config-title">
              <textarea
                className="editable-field port-name"
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
              {/* Timezone with large +/- controls (same as create) */}
              <div className="timezone-control">
                <button
                  type="button"
                  className="tz-btn tz-minus"
                  onClick={() => adjustTimezone(-0.5)}
                  aria-label="Decrease timezone"
                >
                  −
                </button>
                <input
                  className="editable-field time-zone tz-input"
                  type="text"
                  inputMode="decimal"
                  placeholder="UTC"
                  value={configData.timezone}
                  onChange={e =>
                    setConfigData(data => ({
                      ...data,
                      timezone: e.target.value.trim(),
                    }))
                  }
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v === "") return;
                    setConfigData(data => ({
                      ...data,
                      timezone: normalizeOffsetString(v),
                    }));
                  }}
                  onWheel={(e) => e.currentTarget.blur()}
                />
                <button
                  type="button"
                  className="tz-btn tz-plus"
                  onClick={() => adjustTimezone(0.5)}
                  aria-label="Increase timezone"
                >
                  +
                </button>
              </div>
            </div>
          ) : activePortDay ? (
            activePortDay.name + (activePortDay.timezone ? ` (UTC ${formatOffsetDisplay(activePortDay.timezone)})` : "")
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
              {/* Removed old standalone timezone input; validation hint remains */}
              {!isValidTimezone(configData.timezone || "") && (
                <small style={{ color: "tomato", marginBottom: 8 }}>
                  Enter a numeric UTC offset between -12 and +14, using .5 if needed (e.g., -1, 2, 2.5).
                </small>
              )}
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
                disabled={!isValidTimezone(configData.timezone || "")}
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
        {/* First row - 4 buttons */}
        <div className="action-buttons-container action-buttons-row-4">
          {["Tender 1", "Tender 2", "Tender 3", "Tender 4"].map(tender => (
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

        {/* Third row - 3 buttons */}
        <div className="action-buttons-container action-buttons-row-3">
          {["Local Tender 1", "Local Tender 2", "Local Tender 3"].map(tender => (
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
      {
        isCustomMessageMode ? (
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
        )
      }
      <div className="button-container">
        <button
          disabled={
            isSending ||
            !(
              (action && direction) ||
              (customMessage && customMessage.trim() !== "")
            )
          }
          onClick={handleSendNotification}
          className={`send-notification-button ${isSending ? 'sending' : ''}`}
        >
          {isSending ? 'Sending...' : 'Send Notification'}
        </button>
      </div>
      <p>Guest Notifications</p>
      {
        notifications.length > 0 ? (
          <ul className="guest-notifications-list-operator">
            {notifications.map((notification) => (
              <li key={notification.id} className="notification-item-operator">
                <div className="notification-content-operator">
                  <p>{notification.message}</p>
                  {notification.timestamp && (
                    <small>
                      {typeof notification.timestamp === "string"
                        ? notification.timestamp
                        : notification.timestamp.seconds
                          ? new Date(notification.timestamp.seconds * 1000).toLocaleString(undefined, {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          })
                          : ""}
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
        )
      }

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
    </div >
  );
}

export default RadioOperatorDashboard;
