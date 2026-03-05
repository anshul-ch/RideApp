let map, driverMap;
let userMarker;
let driverMarkers = [];
let userLat, userLng;
let currentRole = null;
let currentDriverId = null;
let currentRideId = null;
let rideStatusInterval = null;
let pendingRidesInterval = null;

function getLocationErrorMessage(err) {
    if (err.code === 1) return 'Location permission denied. Please allow location access in your browser settings.';
    if (err.code === 2) return 'Location unavailable. Make sure GPS is enabled on your device.';
    if (err.code === 3) return 'Location request timed out. Please try again.';
    return 'Unable to get your location.';
}

function isSecureContext() {
    return window.isSecureContext || location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
}

function initMapAt(containerId, lat, lng, zoom) {
    var m = L.map(containerId).setView([lat, lng], zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
    }).addTo(m);
    return m;
}

function selectRole(role) {
    currentRole = role;
    document.getElementById('roleSelection').style.display = 'none';

    if (role === 'user') {
        document.getElementById('userPanel').style.display = 'block';
        initUserMap();
    } else {
        document.getElementById('driverPanel').style.display = 'block';
    }
}

function initUserMap() {
    if (!navigator.geolocation || !isSecureContext()) {
        showMessage('userMessage',
            'Geolocation requires HTTPS. ' +
            (location.protocol !== 'https:' && location.hostname !== 'localhost'
                ? 'This page is served over HTTP — please access it via HTTPS.'
                : 'Your browser does not support geolocation.') +
            ' You can enter your location manually below.', 'warning');
        showManualLocationInput();
        // Still load the map with a default view
        map = initMapAt('map', 28.6139, 77.2090, 12);
        return;
    }

    showMessage('userMessage', 'Getting your location...', 'info');

    navigator.geolocation.getCurrentPosition(function (pos) {
        userLat = pos.coords.latitude;
        userLng = pos.coords.longitude;

        map = initMapAt('map', userLat, userLng, 14);

        userMarker = L.marker([userLat, userLng])
            .addTo(map)
            .bindPopup('You are here')
            .openPopup();

        showMessage('userMessage', 'Location acquired!', 'success');
        setTimeout(function () {
            document.getElementById('userMessage').style.display = 'none';
        }, 2000);

        navigator.geolocation.watchPosition(function (p) {
            userLat = p.coords.latitude;
            userLng = p.coords.longitude;
            userMarker.setLatLng([userLat, userLng]);
        }, null, { enableHighAccuracy: true });
    }, function (err) {
        showMessage('userMessage', getLocationErrorMessage(err) + ' You can enter your location manually below.', 'danger');
        showManualLocationInput();
        map = initMapAt('map', 28.6139, 77.2090, 12);
    }, { enableHighAccuracy: true, timeout: 10000 });
}

function showManualLocationInput() {
    var container = document.getElementById('driverList');
    container.innerHTML =
        '<div class="card mb-3"><div class="card-body">' +
        '<h5>Set Location Manually</h5>' +
        '<div class="row g-2 mb-2">' +
        '<div class="col"><input type="number" step="any" class="form-control" id="manualLat" placeholder="Latitude" /></div>' +
        '<div class="col"><input type="number" step="any" class="form-control" id="manualLng" placeholder="Longitude" /></div>' +
        '</div>' +
        '<button class="btn btn-outline-primary btn-sm" onclick="applyManualLocation()">Set Location</button>' +
        '</div></div>';
}

function applyManualLocation() {
    var lat = parseFloat(document.getElementById('manualLat').value);
    var lng = parseFloat(document.getElementById('manualLng').value);
    if (isNaN(lat) || isNaN(lng)) {
        alert('Please enter valid latitude and longitude values.');
        return;
    }
    userLat = lat;
    userLng = lng;
    map.setView([lat, lng], 14);
    if (userMarker) {
        userMarker.setLatLng([lat, lng]);
    } else {
        userMarker = L.marker([lat, lng]).addTo(map).bindPopup('Your location').openPopup();
    }
    document.getElementById('driverList').innerHTML = '';
    showMessage('userMessage', 'Location set! You can now find nearby drivers.', 'success');
}

function findDrivers() {
    var name = document.getElementById('userName').value.trim();
    if (!name) {
        showMessage('userMessage', 'Please enter your name.', 'warning');
        return;
    }
    if (!userLat || !userLng) {
        showMessage('userMessage', 'Waiting for location... Please allow location access.', 'warning');
        return;
    }

    driverMarkers.forEach(function (m) { map.removeLayer(m); });
    driverMarkers = [];

    fetch('/Ride/FindDrivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: userLat, longitude: userLng })
    })
    .then(function (r) { return r.json(); })
    .then(function (drivers) {
        var list = document.getElementById('driverList');

        if (drivers.length === 0) {
            list.innerHTML = '<div class="alert alert-info">No drivers available within 5 km. Please try again later.</div>';
            showMessage('userMessage', 'No drivers found nearby.', 'info');
            return;
        }

        var html = '<h4>Available Drivers Nearby</h4><div class="list-group">';
        drivers.forEach(function (d) {
            var marker = L.marker([d.location.latitude, d.location.longitude])
                .addTo(map)
                .bindPopup('🚗 ' + d.name + ' - ' + d.vehicleNumber);
            driverMarkers.push(marker);

            html += '<div class="list-group-item d-flex justify-content-between align-items-center">' +
                '<div><strong>' + d.name + '</strong> - ' + d.vehicleNumber + '</div>' +
                '<button class="btn btn-sm btn-primary" onclick="requestRide(\'' + d.id + '\')">Request Ride</button>' +
                '</div>';
        });
        html += '</div>';
        list.innerHTML = html;

        showMessage('userMessage', 'Found ' + drivers.length + ' driver(s) within 5 km!', 'success');
    })
    .catch(function () {
        showMessage('userMessage', 'Error finding drivers. Please try again.', 'danger');
    });
}

function requestRide(driverId) {
    var name = document.getElementById('userName').value.trim();

    fetch('/Ride/RequestRide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userName: name,
            latitude: userLat,
            longitude: userLng,
            driverId: driverId
        })
    })
    .then(function (r) { return r.json(); })
    .then(function (ride) {
        currentRideId = ride.id;
        document.getElementById('driverList').innerHTML =
            '<div class="alert alert-info">Ride requested! Waiting for driver to respond...</div>';
        showMessage('userMessage', 'Ride request sent! Waiting for driver response...', 'info');

        rideStatusInterval = setInterval(checkRideStatus, 3000);
    })
    .catch(function () {
        showMessage('userMessage', 'Error requesting ride. Please try again.', 'danger');
    });
}

function checkRideStatus() {
    if (!currentRideId) return;

    fetch('/Ride/RideStatus?id=' + currentRideId)
        .then(function (r) { return r.json(); })
        .then(function (ride) {
            if (ride.status === 'Accepted') {
                clearInterval(rideStatusInterval);
                document.getElementById('driverList').innerHTML =
                    '<div class="alert alert-success">' +
                    '<h5>🎉 Ride Confirmed!</h5>' +
                    '<p>Your driver is on the way. Have a safe trip!</p></div>';
                showMessage('userMessage', 'Your ride has been accepted!', 'success');
            } else if (ride.status === 'Rejected') {
                clearInterval(rideStatusInterval);
                document.getElementById('driverList').innerHTML =
                    '<div class="alert alert-warning">' +
                    '<p>The driver declined your request. Please try another driver.</p>' +
                    '<button class="btn btn-primary" onclick="findDrivers()">Find Other Drivers</button></div>';
                showMessage('userMessage', 'Ride was declined. Try another driver.', 'warning');
                currentRideId = null;
            }
        });
}

function registerDriver() {
    var name = document.getElementById('driverName').value.trim();
    var vehicle = document.getElementById('vehicleNumber').value.trim();

    if (!name || !vehicle) {
        alert('Please enter your name and vehicle number.');
        return;
    }

    if (!navigator.geolocation || !isSecureContext()) {
        alert('Geolocation requires HTTPS. Please access this site via HTTPS or localhost.');
        return;
    }

    navigator.geolocation.getCurrentPosition(function (pos) {
        var lat = pos.coords.latitude;
        var lng = pos.coords.longitude;

        fetch('/Ride/RegisterDriver', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name,
                vehicleNumber: vehicle,
                isAvailable: true,
                location: { latitude: lat, longitude: lng }
            })
        })
        .then(function (r) { return r.json(); })
        .then(function (driver) {
            currentDriverId = driver.id;
            document.getElementById('driverRegForm').style.display = 'none';
            document.getElementById('driverDashboard').style.display = 'block';

            driverMap = L.map('driverMap').setView([lat, lng], 14);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap'
            }).addTo(driverMap);
            var driverMarker = L.marker([lat, lng]).addTo(driverMap).bindPopup('Your location').openPopup();

            // Continuously watch driver location, update marker and DB
            navigator.geolocation.watchPosition(function (p) {
                var newLat = p.coords.latitude;
                var newLng = p.coords.longitude;
                driverMarker.setLatLng([newLat, newLng]);

                fetch('/Ride/UpdateDriverLocation', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        driverId: currentDriverId,
                        latitude: newLat,
                        longitude: newLng
                    })
                });
            }, null, { enableHighAccuracy: true });

            pendingRidesInterval = setInterval(checkPendingRides, 3000);
        })
        .catch(function () {
            alert('Error registering. Please try again.');
        });
    }, function (err) {
        alert(getLocationErrorMessage(err));
    }, { enableHighAccuracy: true, timeout: 10000 });
}

function checkPendingRides() {
    if (!currentDriverId) return;

    fetch('/Ride/PendingRides?driverId=' + currentDriverId)
        .then(function (r) { return r.json(); })
        .then(function (rides) {
            var container = document.getElementById('pendingRides');

            if (rides.length === 0) {
                container.innerHTML = '<p class="text-muted">No pending requests. Waiting for ride requests...</p>';
                return;
            }

            var html = '';
            rides.forEach(function (r) {
                html += '<div class="card mb-2"><div class="card-body">' +
                    '<h5>' + r.userName + '</h5>' +
                    '<p class="text-muted">Requesting a ride</p>' +
                    '<button class="btn btn-success btn-sm me-2" onclick="respondRide(\'' + r.id + '\', true)">Accept</button>' +
                    '<button class="btn btn-danger btn-sm" onclick="respondRide(\'' + r.id + '\', false)">Reject</button>' +
                    '</div></div>';
            });
            container.innerHTML = html;
        });
}

function respondRide(rideId, accept) {
    var action = accept ? 'AcceptRide' : 'RejectRide';

    fetch('/Ride/' + action + '?id=' + rideId, { method: 'POST' })
        .then(function (r) { return r.json(); })
        .then(function (result) {
            if (result.success) {
                var msg = accept ? 'Ride accepted! The user has been notified.' : 'Ride rejected.';
                alert(msg);
                checkPendingRides();
            }
        })
        .catch(function () {
            alert('Error responding to ride. Please try again.');
        });
}

function showMessage(elementId, message, type) {
    var el = document.getElementById(elementId);
    el.className = 'alert alert-' + type;
    el.textContent = message;
    el.style.display = 'block';
}