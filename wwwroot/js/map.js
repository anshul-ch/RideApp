var map, driverMap, userMarker, driverLiveMarker, userLiveMarkerOnDriverMap;
var driverMarkers = [];
var userLat, userLng, driverLat, driverLng;
var currentDriverId, currentRideId, acceptedRideId;
var pollTimer, pendingTimer, trackTimer, userPushTimer, userPollTimer, driverPushTimer;

function el(id) { return document.getElementById(id); }
function show(id) { el(id).style.display = 'block'; }
function hide(id) { el(id).style.display = 'none'; }

function msg(id, text, type) {
    var e = el(id);
    e.className = 'alert alert-' + type;
    e.textContent = text;
    show(id);
}

function post(url, data) {
    return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }).then(function (r) { return r.json(); });
}

function get(url) {
    return fetch(url).then(function (r) { return r.json(); });
}

function makeMap(id, lat, lng, zoom) {
    var m = L.map(id).setView([lat, lng], zoom || 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
    }).addTo(m);
    return m;
}

function emoji(ch) {
    return L.divIcon({ html: '<div style="font-size:24px">' + ch + '</div>', iconSize: [30, 30], iconAnchor: [15, 15] });
}

function fitTwo(m, a, b) {
    m.fitBounds(L.latLngBounds(a, b), { padding: [50, 50] });
}

function getLocation(ok, fail) {
    if (!navigator.geolocation || !window.isSecureContext) {
        fail('Geolocation needs HTTPS.');
        return;
    }
    navigator.geolocation.getCurrentPosition(
        function (p) { ok(p.coords.latitude, p.coords.longitude); },
        function () {
            navigator.geolocation.getCurrentPosition(
                function (p) { ok(p.coords.latitude, p.coords.longitude); },
                function () { fail('Could not get location. Check browser permissions.'); },
                { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
            );
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 30000 }
    );
}

function startWatching(onUpdate) {
    if (!navigator.geolocation) return;
    navigator.geolocation.watchPosition(function (p) {
        onUpdate(p.coords.latitude, p.coords.longitude);
    }, null, { enableHighAccuracy: false, maximumAge: 10000 });
}


function selectRole(role) {
    hide('roleSelection');
    if (role === 'user') { show('userPanel'); initUserMap(); }
    else show('driverPanel');
}


function initUserMap() {
    msg('userMessage', 'Getting your location...', 'info');

    getLocation(function (lat, lng) {
        userLat = lat;
        userLng = lng;
        map = makeMap('map', lat, lng);
        userMarker = L.marker([lat, lng]).addTo(map).bindPopup('You').openPopup();
        hide('userMessage');

        startWatching(function (la, ln) {
            userLat = la; userLng = ln;
            userMarker.setLatLng([la, ln]);
        });
    }, function (err) {
        msg('userMessage', err + ' Enter location manually.', 'warning');
        map = makeMap('map', 28.6139, 77.2090, 12);
        showManualInput('driverList', 'manualLat', 'manualLng', applyManualLocation);
    });
}

function showManualInput(containerId, latId, lngId, onApply) {
    el(containerId).innerHTML =
        '<div class="card mb-3"><div class="card-body">' +
        '<h6>Set Location Manually</h6>' +
        '<div class="row g-2 mb-2">' +
        '<div class="col"><input type="number" step="any" class="form-control" id="' + latId + '" placeholder="Latitude"></div>' +
        '<div class="col"><input type="number" step="any" class="form-control" id="' + lngId + '" placeholder="Longitude"></div>' +
        '</div>' +
        '<button class="btn btn-outline-primary btn-sm" id="' + latId + 'Btn">Set Location</button>' +
        '</div></div>';
    el(latId + 'Btn').onclick = onApply;
}

function applyManualLocation() {
    var lat = parseFloat(el('manualLat').value);
    var lng = parseFloat(el('manualLng').value);
    if (isNaN(lat) || isNaN(lng)) { alert('Enter valid coordinates.'); return; }
    userLat = lat; userLng = lng;
    map.setView([lat, lng], 14);
    if (userMarker) userMarker.setLatLng([lat, lng]);
    else userMarker = L.marker([lat, lng]).addTo(map).bindPopup('You').openPopup();
    el('driverList').innerHTML = '';
    msg('userMessage', 'Location set!', 'success');
}

function findDrivers() {
    var name = el('userName').value.trim();
    if (!name) { msg('userMessage', 'Enter your name.', 'warning'); return; }
    if (!userLat) { msg('userMessage', 'Location not set yet.', 'warning'); return; }

    driverMarkers.forEach(function (m) { map.removeLayer(m); });
    driverMarkers = [];

    post('/Ride/FindDrivers', { latitude: userLat, longitude: userLng }).then(function (drivers) {
        var list = el('driverList');
        if (!drivers.length) {
            list.innerHTML = '<div class="alert alert-info">No drivers available right now.</div>';
            return;
        }

        var html = '<h5>Available Drivers</h5><div class="list-group">';
        drivers.forEach(function (d) {
            var m = L.marker([d.location.latitude, d.location.longitude]).addTo(map)
                .bindPopup(d.name + ' - ' + d.vehicleNumber);
            driverMarkers.push(m);
            html += '<div class="list-group-item d-flex justify-content-between align-items-center">' +
                '<span><strong>' + d.name + '</strong> — ' + d.vehicleNumber + '</span>' +
                '<button class="btn btn-sm btn-primary" onclick="requestRide(\'' + d.id + '\')">Request</button></div>';
        });
        list.innerHTML = html + '</div>';
        msg('userMessage', drivers.length + ' driver(s) found.', 'success');
    });
}

function requestRide(driverId) {
    var name = el('userName').value.trim();
    post('/Ride/RequestRide', { userName: name, latitude: userLat, longitude: userLng, driverId: driverId })
        .then(function (ride) {
            currentRideId = ride.id;
            el('driverList').innerHTML = '<div class="alert alert-info">Waiting for driver...</div>';
            pollTimer = setInterval(checkRideStatus, 3000);
        });
}

function checkRideStatus() {
    if (!currentRideId) return;

    get('/Ride/RideDetails?id=' + currentRideId).then(function (ride) {
        if (ride.status === 'Accepted') {
            clearInterval(pollTimer);
            driverMarkers.forEach(function (m) { map.removeLayer(m); });
            driverMarkers = [];

            driverLiveMarker = L.marker(
                [ride.driverLocation.latitude, ride.driverLocation.longitude],
                { icon: emoji('🚗') }
            ).addTo(map).bindPopup(ride.driverName + ' — ' + ride.driverVehicle);

            fitTwo(map, [userLat, userLng], [ride.driverLocation.latitude, ride.driverLocation.longitude]);

            el('driverList').innerHTML =
                '<div class="alert alert-success"><h5>Ride Confirmed!</h5>' +
                '<p><strong>' + ride.driverName + '</strong> (' + ride.driverVehicle + ') is coming.</p></div>';

            trackTimer = setInterval(function () {
                get('/Ride/DriverLocation?driverId=' + ride.driverId).then(function (loc) {
                    if (driverLiveMarker) driverLiveMarker.setLatLng([loc.latitude, loc.longitude]);
                });
            }, 3000);

            userPushTimer = setInterval(function () {
                if (userLat && userLng) {
                    post('/Ride/UpdateUserLocation', { rideId: currentRideId, latitude: userLat, longitude: userLng });
                }
            }, 3000);

        } else if (ride.status === 'Rejected') {
            clearInterval(pollTimer);
            el('driverList').innerHTML =
                '<div class="alert alert-warning">Driver declined. ' +
                '<button class="btn btn-primary btn-sm" onclick="findDrivers()">Try Again</button></div>';
            currentRideId = null;
        }
    });
}


function registerDriver() {
    var name = el('driverName').value.trim();
    var vehicle = el('vehicleNumber').value.trim();
    if (!name || !vehicle) { alert('Fill in name and vehicle number.'); return; }

    var btn = document.querySelector('#driverRegForm button');
    btn.disabled = true; btn.textContent = 'Getting location...';

    getLocation(function (lat, lng) {
        goOnline(name, vehicle, lat, lng);
    }, function (err) {
        btn.disabled = false; btn.textContent = 'Go Online';
        alert(err + ' Enter location manually.');
        if (!el('driverManualLoc')) {
            var div = document.createElement('div');
            div.id = 'driverManualLoc';
            div.className = 'mt-3';
            div.innerHTML =
                '<div class="row g-2 mb-2">' +
                '<div class="col"><input type="number" step="any" class="form-control" id="drvLat" placeholder="Latitude"></div>' +
                '<div class="col"><input type="number" step="any" class="form-control" id="drvLng" placeholder="Longitude"></div>' +
                '</div><button class="btn btn-outline-success btn-sm" onclick="registerDriverManual()">Go Online</button>';
            el('driverRegForm').appendChild(div);
        }
    });
}

function registerDriverManual() {
    var lat = parseFloat(el('drvLat').value), lng = parseFloat(el('drvLng').value);
    if (isNaN(lat) || isNaN(lng)) { alert('Enter valid coordinates.'); return; }
    var name = el('driverName').value.trim(), vehicle = el('vehicleNumber').value.trim();
    goOnline(name, vehicle, lat, lng);
}

function goOnline(name, vehicle, lat, lng) {
    driverLat = lat; driverLng = lng;

    post('/Ride/RegisterDriver', { name: name, vehicleNumber: vehicle, isAvailable: true, location: { latitude: lat, longitude: lng } })
        .then(function (driver) {
            currentDriverId = driver.id;
            hide('driverRegForm');
            show('driverDashboard');

            driverMap = makeMap('driverMap', lat, lng);
            var marker = L.marker([lat, lng]).addTo(driverMap).bindPopup('You').openPopup();

            startWatching(function (la, ln) {
                driverLat = la; driverLng = ln;
                marker.setLatLng([la, ln]);
            });

            driverPushTimer = setInterval(function () {
                if (driverLat && driverLng && currentDriverId) {
                    post('/Ride/UpdateDriverLocation', { driverId: currentDriverId, latitude: driverLat, longitude: driverLng });
                }
            }, 3000);

            pendingTimer = setInterval(checkPendingRides, 3000);
        });
}

function checkPendingRides() {
    if (!currentDriverId) return;

    get('/Ride/PendingRides?driverId=' + currentDriverId).then(function (rides) {
        var e = el('pendingRides');
        if (!rides.length) { e.innerHTML = '<p class="text-muted">No pending requests...</p>'; return; }

        var html = '';
        rides.forEach(function (r) {
            html += '<div class="card mb-2"><div class="card-body">' +
                '<h6>' + r.userName + '</h6>' +
                '<button class="btn btn-success btn-sm me-2" onclick="respondRide(\'' + r.id + '\',true)">Accept</button>' +
                '<button class="btn btn-danger btn-sm" onclick="respondRide(\'' + r.id + '\',false)">Reject</button>' +
                '</div></div>';
        });
        e.innerHTML = html;
    });
}

function respondRide(rideId, accept) {
    var url = '/Ride/' + (accept ? 'AcceptRide' : 'RejectRide') + '?id=' + rideId;
    post(url).then(function (res) {
        if (!res.success) return;
        if (!accept) { checkPendingRides(); return; }

        clearInterval(pendingTimer);
        acceptedRideId = rideId;

        get('/Ride/RideDetails?id=' + rideId).then(function (ride) {
            var loc = ride.userLocation;
            userLiveMarkerOnDriverMap = L.marker(
                [loc.latitude, loc.longitude], { icon: emoji('🧑') }
            ).addTo(driverMap).bindPopup(ride.userName + ' (Pickup)').openPopup();

            fitTwo(driverMap, driverMap.getCenter(), [loc.latitude, loc.longitude]);

            el('pendingRides').innerHTML =
                '<div class="alert alert-success"><h5>Ride Accepted</h5>' +
                '<p>Picking up <strong>' + ride.userName + '</strong></p></div>';

            userPollTimer = setInterval(function () {
                get('/Ride/UserLocation?rideId=' + acceptedRideId).then(function (loc) {
                    if (userLiveMarkerOnDriverMap) userLiveMarkerOnDriverMap.setLatLng([loc.latitude, loc.longitude]);
                });
            }, 3000);
        });
    });
}
