"use client";

import { useEffect, useRef } from "react";

export default function Home() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // ==========================================
    // STATE & DATA
    // ==========================================
    const state = {
      currentView: "home",
      reportStep: 1,
      reportData: {
        image: null,
        location: null,
        address: "",
        description: "",
        severity: "medium",
      },
      maps: {
        mini: null,
        main: null,
        miniMarker: null,
      },
      mockData: [
        {
          id: 1,
          lat: 40.7128,
          lng: -74.006,
          status: "new",
          sev: "high",
          date: "2 hours ago",
        },
        {
          id: 2,
          lat: 40.72,
          lng: -73.99,
          status: "progress",
          sev: "medium",
          date: "Yesterday",
        },
        {
          id: 3,
          lat: 40.705,
          lng: -74.015,
          status: "fixed",
          sev: "low",
          date: "3 days ago",
        },
      ],
    };

    // Make state available for inline onclick handlers
    window.__geoState = state;

    // Set initial disabled state imperatively (React JSX disabled prop fights DOM manipulation)
    const btnStep1 = document.getElementById("btn-next-step-1");
    const btnStep2 = document.getElementById("btn-next-step-2");
    if (btnStep1) btnStep1.disabled = true;
    if (btnStep2) btnStep2.disabled = true;

    // ==========================================
    // NAVIGATION (Tabs)
    // ==========================================
    function navigateTo(viewId) {
      if (state.currentView === viewId) return;

      document
        .querySelectorAll(".view")
        .forEach((el) => el.classList.remove("active"));
      document.getElementById(`view-${viewId}`).classList.add("active");

      document
        .querySelectorAll(".nav-item")
        .forEach((el) => el.classList.remove("active"));
      document.getElementById(`nav-${viewId}`).classList.add("active");

      state.currentView = viewId;

      if (viewId === "report") {
        resetReportFlow();
      } else if (viewId === "map") {
        setTimeout(initMainMap, 100);
      }
    }
    window.navigateTo = navigateTo;

    // ==========================================
    // REPORT FLOW
    // ==========================================
    function nextReportStep(stepNumber) {
      document
        .querySelectorAll(".report-step")
        .forEach((el) => el.classList.remove("active"));
      document
        .getElementById(`report-step-${stepNumber}`)
        .classList.add("active");

      document.querySelectorAll(".step").forEach((el, index) => {
        if (index + 1 === stepNumber) {
          el.classList.add("active");
          el.classList.remove("completed");
        } else if (index + 1 < stepNumber) {
          el.classList.remove("active");
          el.classList.add("completed");
          el.innerHTML = '<i class="fa-solid fa-check"></i>';
        } else {
          el.classList.remove("active", "completed");
          el.innerHTML = index + 1;
        }
      });

      document.querySelectorAll(".step-line").forEach((el, index) => {
        if (index + 1 < stepNumber) el.classList.add("active");
        else el.classList.remove("active");
      });

      state.reportStep = stepNumber;

      if (stepNumber === 2) {
        requestLocation();
      }
    }
    window.nextReportStep = nextReportStep;

    function resetReportFlow() {
      state.reportStep = 1;
      state.reportData = {
        image: null,
        location: null,
        address: "",
        description: "",
        severity: "medium",
      };

      document.getElementById("image-preview").style.display = "none";
      document.getElementById("image-preview").src = "";
      document.getElementById("camera-placeholder").style.display = "flex";
      document.getElementById("pothole-image").value = "";
      document.getElementById("btn-next-step-1").disabled = true;

      document.getElementById("pothole-address").value = "";
      document.getElementById("pothole-desc").value = "";
      selectSeverity("medium");

      nextReportStep(1);
    }

    // Step 1: Camera Logic
    const potholeImageInput = document.getElementById("pothole-image");
    if (potholeImageInput) {
      potholeImageInput.addEventListener("change", function (e) {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = function (event) {
            const preview = document.getElementById("image-preview");
            preview.src = event.target.result;
            preview.style.display = "block";
            document.getElementById("camera-placeholder").style.display =
              "none";
            document.getElementById("btn-next-step-1").disabled = false;
            state.reportData.image = file;
          };
          reader.readAsDataURL(file);
        }
      });
    }

    // Step 2: Location & Mini Map Logic
    function requestLocation() {
      const statusEl = document.getElementById("location-status");
      const btnNext = document.getElementById("btn-next-step-2");

      statusEl.className = "location-status";
      statusEl.innerHTML =
        '<i class="fa-solid fa-spinner fa-spin"></i> Finding your exact location...';
      btnNext.disabled = true;

      if (!navigator.geolocation) {
        statusEl.innerHTML =
          '<i class="fa-solid fa-triangle-exclamation"></i> Geolocation not supported by browser.';
        statusEl.classList.add("error");
        initMiniMap(40.7128, -74.006);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          state.reportData.location = { lat: latitude, lng: longitude };

          statusEl.className = "location-status success";
          statusEl.innerHTML =
            '<i class="fa-solid fa-location-dot"></i> Location acquired (accuracy: ' +
            Math.round(position.coords.accuracy) +
            "m)";
          btnNext.disabled = false;

          initMiniMap(latitude, longitude);
        },
        (error) => {
          console.error(error);
          statusEl.className = "location-status text-warning";
          statusEl.innerHTML =
            '<i class="fa-solid fa-triangle-exclamation"></i> Could not get exact location. Please drag the pin manually.';
          btnNext.disabled = false;
          initMiniMap(40.7128, -74.006);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }

    function initMiniMap(lat, lng) {
      const L = window.L;
      if (!L) return;

      if (state.maps.mini) {
        state.maps.mini.setView([lat, lng], 17);
        if (state.maps.miniMarker) state.maps.miniMarker.setLatLng([lat, lng]);
        setTimeout(() => state.maps.mini.invalidateSize(), 50);
        return;
      }

      const mapEl = document.getElementById("report-map");

      state.maps.mini = L.map(mapEl, {
        zoomControl: false,
      }).setView([lat, lng], 17);

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        {
          attribution: "&copy; OpenStreetMap &copy; CARTO",
        }
      ).addTo(state.maps.mini);

      const icon = L.divIcon({
        className: "custom-pin",
        html: '<i class="fa-solid fa-location-dot" style="color: var(--danger); font-size: 2rem; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3)); transform: translateY(-50%)"></i>',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });

      state.maps.miniMarker = L.marker([lat, lng], {
        draggable: true,
        icon: icon,
      }).addTo(state.maps.mini);

      state.maps.miniMarker.on("dragend", function (e) {
        const marker = e.target;
        const position = marker.getLatLng();
        state.reportData.location = { lat: position.lat, lng: position.lng };
      });

      setTimeout(() => state.maps.mini.invalidateSize(), 150);
    }

    // Step 3: Details Logic
    function selectSeverity(level) {
      state.reportData.severity = level;
      document
        .querySelectorAll(".sev-btn")
        .forEach((btn) => btn.classList.remove("active"));
      document.querySelector(`.sev-btn.${level}`).classList.add("active");
    }
    window.selectSeverity = selectSeverity;

    function submitReport() {
      state.reportData.address =
        document.getElementById("pothole-address").value;
      state.reportData.description =
        document.getElementById("pothole-desc").value;

      const overlay = document.getElementById("loading-overlay");
      overlay.classList.remove("hidden");

      setTimeout(() => {
        overlay.classList.add("hidden");

        document
          .querySelectorAll(".report-step")
          .forEach((el) => el.classList.remove("active"));
        document.getElementById("report-success").classList.add("active");

        if (state.reportData.location) {
          state.mockData.push({
            id: Date.now(),
            lat: state.reportData.location.lat,
            lng: state.reportData.location.lng,
            status: "new",
            sev: state.reportData.severity,
            date: "Just now",
          });
          renderActivityFeed();
        }
      }, 1500);
    }
    window.submitReport = submitReport;

    function resetReportAndGoHome() {
      navigateTo("home");
    }
    window.resetReportAndGoHome = resetReportAndGoHome;

    // ==========================================
    // MAIN MAP VIEW
    // ==========================================
    function initMainMap() {
      const L = window.L;
      if (!L) return;

      if (state.maps.main) {
        state.maps.main.invalidateSize();
        return;
      }

      const mapEl = document.getElementById("main-map");

      const centerLat = state.mockData.length
        ? state.mockData[state.mockData.length - 1].lat
        : 40.7128;
      const centerLng = state.mockData.length
        ? state.mockData[state.mockData.length - 1].lng
        : -74.006;

      state.maps.main = L.map(mapEl).setView([centerLat, centerLng], 14);

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        {
          attribution: "&copy; OpenStreetMap",
        }
      ).addTo(state.maps.main);

      L.control.zoom({ position: "bottomright" }).addTo(state.maps.main);

      plotMapData();

      setTimeout(() => state.maps.main.invalidateSize(), 200);
    }

    function plotMapData() {
      const L = window.L;
      if (!state.maps.main || !L) return;

      state.maps.main.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
          state.maps.main.removeLayer(layer);
        }
      });

      state.mockData.forEach((item) => {
        let color = "var(--danger)";
        if (item.status === "progress") color = "var(--warning)";
        else if (item.status === "fixed") color = "var(--success)";

        const icon = L.divIcon({
          className: "custom-pin",
          html: `<i class="fa-solid fa-location-dot" style="color: ${color}; font-size: 2rem; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); transform: translateY(-50%)"></i>`,
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          popupAnchor: [0, -32],
        });

        const popupContent = `
            <div style="text-align:center; font-family:'Inter', sans-serif;">
                <strong>${item.status.toUpperCase()}</strong><br>
                <span>Severity: ${item.sev}</span><br>
                <small style="color:var(--text-tertiary)">Reported: ${item.date}</small>
            </div>
        `;

        L.marker([item.lat, item.lng], { icon: icon })
          .bindPopup(popupContent)
          .addTo(state.maps.main);
      });
    }

    // ==========================================
    // HOME VIEW FEED
    // ==========================================
    function renderActivityFeed() {
      const list = document.querySelector(".activity-list");
      if (!list) return;
      list.innerHTML = "";

      const recent = [...state.mockData].reverse().slice(0, 4);

      recent.forEach((item) => {
        let iconClass = "new";
        let iconHtml = '<i class="fa-solid fa-car-burst"></i>';
        let text = "New pothole reported";

        if (item.status === "progress") {
          iconClass = "progress";
          iconHtml = '<i class="fa-solid fa-person-digging"></i>';
          text = "Repair in progress";
        } else if (item.status === "fixed") {
          iconClass = "fixed";
          iconHtml = '<i class="fa-solid fa-check-double"></i>';
          text = "Pothole fixed!";
        }

        const html = `
            <div class="activity-card">
                <div class="activity-icon ${iconClass}">
                    ${iconHtml}
                </div>
                <div class="activity-details">
                    <div class="activity-title">${text}</div>
                    <div class="activity-meta">
                        <span><i class="fa-regular fa-clock"></i> ${item.date}</span>
                        <span><i class="fa-solid fa-triangle-exclamation" style="color:${item.sev === "high" ? "var(--danger)" : "inherit"}"></i> ${item.sev} freq</span>
                    </div>
                </div>
            </div>
        `;
        list.insertAdjacentHTML("beforeend", html);
      });
    }

    // Initialize Home Feed
    renderActivityFeed();
  }, []);

  return (
    <div id="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-logo">
          <i className="fa-solid fa-road-circle-exclamation"></i>
          <h1>GeoPothole</h1>
        </div>
        <button className="header-action" aria-label="Notifications">
          <i className="fa-regular fa-bell"></i>
        </button>
      </header>

      {/* Main Content Area (Views) */}
      <main id="main-content">
        {/* VIEW: HOME */}
        <section id="view-home" className="view active">
          <div className="hero-section">
            <h2>Spotted a pothole?</h2>
            <p>Help fix our roads in under 30 seconds.</p>

            <button
              className="btn-primary btn-massive pulse-animation"
              onClick={() => window.navigateTo("report")}
            >
              <i className="fa-solid fa-camera"></i>
              <span>Report Pothole Now</span>
            </button>
          </div>

          <div className="stats-card">
            <div className="stat-item">
              <span className="stat-value">142</span>
              <span className="stat-label">Reported</span>
            </div>
            <div className="stat-item">
              <span className="stat-value text-success">89</span>
              <span className="stat-label">Fixed</span>
            </div>
          </div>

          <div className="recent-activity">
            <h3>Recent Activity</h3>
            <div className="activity-list">{/* Populated by JS */}</div>
          </div>
        </section>

        {/* VIEW: REPORT (3 Steps) */}
        <section id="view-report" className="view">
          <div className="view-header">
            <h2>New Report</h2>
            <div className="step-indicator">
              <span className="step active" id="indicator-step-1">
                1
              </span>
              <div className="step-line"></div>
              <span className="step" id="indicator-step-2">
                2
              </span>
              <div className="step-line"></div>
              <span className="step" id="indicator-step-3">
                3
              </span>
            </div>
          </div>

          {/* Step 1: Photo */}
          <div id="report-step-1" className="report-step active">
            <h3>Take a Photo</h3>
            <p className="subtitle">Show us the damage</p>

            <div
              className="camera-container"
              id="camera-dropzone"
              onClick={() =>
                document.getElementById("pothole-image").click()
              }
            >
              <input
                type="file"
                id="pothole-image"
                accept="image/*"
                capture="environment"
                hidden
              />
              <div className="camera-placeholder" id="camera-placeholder">
                <i className="fa-solid fa-camera-retro"></i>
                <span>Tap to Open Camera</span>
              </div>
              <img
                id="image-preview"
                src=""
                alt="Pothole Preview"
                style={{ display: "none" }}
              />
            </div>

            <div className="step-actions">
              <button
                className="btn-secondary"
                onClick={() => window.navigateTo("home")}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                id="btn-next-step-1"
                onClick={() => window.nextReportStep(2)}
              >
                Next Step <i className="fa-solid fa-arrow-right"></i>
              </button>
            </div>
          </div>

          {/* Step 2: Location */}
          <div id="report-step-2" className="report-step">
            <h3>Location</h3>
            <p className="subtitle">Where is this pothole?</p>

            <div className="location-status" id="location-status">
              <i className="fa-solid fa-spinner fa-spin"></i> Finding your
              location...
            </div>

            <div
              className="map-container mini-map"
              id="report-map"
            ></div>

            <p className="help-text">
              <i className="fa-solid fa-hand-pointer"></i> Drag the map to
              adjust exactly where the pothole is.
            </p>

            <div className="form-group">
              <label htmlFor="pothole-address">
                Manual Address (Optional)
              </label>
              <input
                type="text"
                id="pothole-address"
                className="text-input"
                placeholder="e.g., 123 Main St near Central Park..."
              />
            </div>

            <div className="step-actions">
              <button
                className="btn-secondary"
                onClick={() => window.nextReportStep(1)}
              >
                Back
              </button>
              <button
                className="btn-primary"
                id="btn-next-step-2"
                onClick={() => window.nextReportStep(3)}
              >
                Next Step <i className="fa-solid fa-arrow-right"></i>
              </button>
            </div>
          </div>

          {/* Step 3: Details & Submit */}
          <div id="report-step-3" className="report-step">
            <h3>Final Details</h3>
            <p className="subtitle">Add a quick note (optional)</p>

            <div className="form-group">
              <label htmlFor="pothole-desc">Description</label>
              <textarea
                id="pothole-desc"
                placeholder="e.g., Deep pothole in the middle lane, hard to see at night..."
              ></textarea>
            </div>

            <div className="severity-selector">
              <label>Severity Level</label>
              <div className="severity-options">
                <button
                  className="sev-btn low"
                  onClick={() => window.selectSeverity("low")}
                >
                  Minor
                </button>
                <button
                  className="sev-btn medium active"
                  onClick={() => window.selectSeverity("medium")}
                >
                  Moderate
                </button>
                <button
                  className="sev-btn high"
                  onClick={() => window.selectSeverity("high")}
                >
                  Severe
                </button>
              </div>
            </div>

            <div className="step-actions vertical">
              <button
                className="btn-primary btn-large btn-submit"
                onClick={() => window.submitReport()}
              >
                <i className="fa-solid fa-paper-plane"></i> Submit Report
              </button>
              <button
                className="btn-text"
                onClick={() => window.nextReportStep(2)}
              >
                Back to Location
              </button>
            </div>
          </div>

          {/* Success State */}
          <div id="report-success" className="report-step success-state">
            <div className="success-icon">
              <i className="fa-solid fa-circle-check"></i>
            </div>
            <h3>Report Submitted!</h3>
            <p>Thank you for helping keep our roads safe.</p>
            <button
              className="btn-primary"
              onClick={() => window.resetReportAndGoHome()}
            >
              Back to Home
            </button>
          </div>
        </section>

        {/* VIEW: MAP */}
        <section id="view-map" className="view">
          <div className="map-header">
            <h2>Live Map</h2>
            <div className="map-legend">
              <span className="legend-item">
                <span className="dot red"></span> Reported
              </span>
              <span className="legend-item">
                <span className="dot orange"></span> In Progress
              </span>
              <span className="legend-item">
                <span className="dot green"></span> Fixed
              </span>
            </div>
          </div>
          <div id="main-map" className="full-map"></div>
        </section>

        {/* VIEW: ABOUT */}
        <section id="view-about" className="view">
          <div className="about-content">
            <h2>About the Project</h2>
            <img
              src="https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
              alt="Road Maintenance"
              className="about-image"
              crossOrigin="anonymous"
            />

            <div className="info-card">
              <h3>Our Mission</h3>
              <p>
                Geo Pothole Detection directly connects citizens with
                municipal workers. Our goal is to reduce reporting friction
                drastically to ensure safer commutes for everyone.
              </p>
            </div>

            <div className="info-card contact-card">
              <h3>Contact Authorities</h3>
              <p>
                For urgent hazards blocking traffic, please call emergency
                services immediately.
              </p>
              <a href="tel:311" className="btn-secondary">
                <i className="fa-solid fa-phone"></i> Call 311
                (Non-Emergency)
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <button
          className="nav-item active"
          onClick={() => window.navigateTo("home")}
          id="nav-home"
        >
          <i className="fa-solid fa-house"></i>
          <span>Home</span>
        </button>
        <button
          className="nav-item nav-item-special"
          onClick={() => window.navigateTo("report")}
          id="nav-report"
        >
          <div className="fab-wrapper">
            <i className="fa-solid fa-plus"></i>
          </div>
          <span>Report</span>
        </button>
        <button
          className="nav-item"
          onClick={() => window.navigateTo("map")}
          id="nav-map"
        >
          <i className="fa-solid fa-map-location-dot"></i>
          <span>Map</span>
        </button>
      </nav>

      {/* Loading Overlay */}
      <div id="loading-overlay" className="overlay hidden">
        <div className="spinner"></div>
        <p id="loading-text">Uploading report...</p>
      </div>
    </div>
  );
}
