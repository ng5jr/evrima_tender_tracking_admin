import React, { useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./PierLocationMap.css";
import L from "leaflet";

import Location from "../assets/location.png";

// Create a custom icon using the location.png
const locationIcon = new L.Icon({
    iconUrl: Location,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
});


function LocationMarker({ position, setPosition }) {
    useMapEvents({
        click(e) {
            setPosition(e.latlng);
        },
    });

    return position ? <Marker position={position} icon={locationIcon} /> : null;
}

export default function PierLocationMap({ initialPosition, onSelect, onClose, onChange }) {
    const [position, setPosition] = useState(initialPosition);

    return (
        <div className="pier-location-map-modal">
            <MapContainer
                center={position || [36.143, -5.353]} // Default: Gibraltar
                zoom={13}
                style={{ height: "400px", width: "100%" }}
            >
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <LocationMarker
                    position={position}
                    setPosition={latlng => {
                        setPosition(latlng);
                        if (onChange) onChange(latlng);
                    }}
                />
            </MapContainer>

        </div>
    );
}