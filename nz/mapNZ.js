pm.plots = {};
//pm.oldPid = null; V-0925
pm.currentPid;
pm.iw = new google.maps.InfoWindow();

pm.SetOrange = function (pid) {
    pm.plots[pid].setOptions({ strokeColor: "#FD5F00", strokeWeight: 2, fillColor: "#FD5F00" });
    pm.plots[pid].marker.setOptions({ icon: pm.marker.iconOrange });
}
pm.SetGreen = function (pid) {
    pm.plots[pid].setOptions({ strokeColor: "#00FF00", strokeWeight: 2, fillColor: "#00FF00" });
    pm.plots[pid].marker.setOptions({ icon: pm.marker.iconGreen });
}

pm.nz.addressRadius = 20;
pm.nz.GetAddressData = function (pid) {

    var bboxCenterLat = pm.plots[pid].center.lat();
    var bboxCenterLng = pm.plots[pid].center.lng();
    var clickLat = parseFloat(pm.nz.clickLatLng[0]);
    var clickLng = parseFloat(pm.nz.clickLatLng[1]);
    var lat = (bboxCenterLat + clickLat + clickLat) / 3;
    var lng = (bboxCenterLng + clickLng + clickLng) / 3;

    pm.nz.addressUrl = "http://api.data.linz.govt.nz/api/vectorQuery.json-gmaps/?v=1.1&key=71ee03a98c254df29f41683eddffbf0c&layer=779&x=" +
    lng + "&y=" + lat + "&max_results=1&radius=" + pm.nz.addressRadius + "&geometry=true&with_field_names=false";

    $.ajax({
        dataType: 'jsonp',
        url: pm.nz.addressUrl,
        cache: false,
        crossDomain: true,
        success: function (data) {
            if (data.vectorQuery.layers[779].features.length === 1) {
                pm.nz.AddressData = data.vectorQuery.layers[779].features[0].properties;
                pm.plots[pid].address = pm.nz.AddressData.address;
                pm.plots[pid].local = pm.nz.AddressData.locality + ", " + pm.nz.AddressData.territorial_authority;
                //pm.nz.AppendAddress();
                pm.nz.addressRadius = 20;
            } else {
                if (pm.nz.addressRadius <= 120) {
                    pm.nz.addressRadius += 50;
                    pm.nz.GetAddressData(pid);
                } else { pm.nz.addressRadius = 20; }
            }
        }
    });
}

pm.nz.AppendAddress = function () {
    $('h3.iwHeading').text(pm.nz.AddressData.address);
    $('small.iwAddress').text(pm.nz.AddressData.locality + ", " + pm.nz.AddressData.territorial_authority)
}

pm.nz.GetParcelData = function (lat, lng) {
    pm.nz.clickLatLng = [lat, lng];
    pm.nz.parcelUrl = "http://api.data.linz.govt.nz/api/vectorQuery.json-gmaps/?v=1.1&key=71ee03a98c254df29f41683eddffbf0c&layer=772&x=" +
    lng + "&y=" + lat + "&max_results=1&radius=100&geometry=true&with_field_names=false";
    $.ajax({
        dataType: 'jsonp',
        url: pm.nz.parcelUrl,
        cache: false,
        crossDomain: true,
        beforeSend: function () { $('#wait').show(); },
        success: function (data) {
            pm.iw.close();
            pm.clicked = {};
            pm.clicked.data = data.vectorQuery.layers[772].features;
            if (pm.clicked.data.length === 1) {
                pm.clicked.polyEncoded = pm.clicked.data[0].geometries[0][0][0];
                pm.clicked.path = google.maps.geometry.encoding.decodePath(pm.clicked.polyEncoded);
                pm.clicked.property = pm.clicked.data[0].properties;
                var pid = pm.clicked.property.id;
                if (pm.currentPid) {
                    pm.SetOrange(pm.currentPid);
                };
                pm.currentPid = pid;
                pm.plots[pid] = new pm.G.Polygon({
                    map: pm.gMap,
                    paths: pm.clicked.path,
                    strokeColor: "#00FF00",
                    strokeOpacity: 0.8,
                    strokeWeight: 3,
                    fillColor: "#00FF00",
                    fillOpacity: 0.05,
                    clickable: true,
                    editable: false
                });

                pm.plots[pid].pid = pm.clicked.property.id;
                pm.plots[pid].appellation = pm.clicked.property.appellation;
                pm.plots[pid].ld = pm.clicked.property.land_district;
                pm.plots[pid].parcel_intent = pm.clicked.property.parcel_intent;
                pm.plots[pid].titles = pm.clicked.property.titles;
                pm.plots[pid].area = pm.clicked.property.calc_area;
                pm.plots[pid].bbox = new google.maps.LatLngBounds;
                pm.clicked.path.forEach(function (item, pos) {
                    pm.plots[pid].bbox.extend(item);
                });
                pm.plots[pid].center = pm.plots[pid].bbox.getCenter();
                pm.marker.Set(pid);

                google.maps.event.addListener(pm.plots[pid], 'click', function (e) {
                    if (pm.currentPid) {
                        pm.SetOrange(pm.currentPid);
                    }
                    pm.SetGreen(this.pid);
                    pm.currentPid = this.pid;
                    $('select#selectPids').val(pm.currentPid);
                    pm.iw.LoadContent(e);
                });

                pm.nz.GetAddressData(pid);

                $('#selectPids').show().append('<option value="' + pm.plots[pid].pid + '" selected="selected">' + pm.plots[pid].pid + '</option>');
            }
            else { alert('The polygon is to detailed. Load the plots and pick a simple polygon. Or hand draw a simple polygon.') }

        },
        error: function (jqXHR, textStatus, errorThrown) {
            $('#wait').hide();
            alert("The request failed: " + textStatus + "\n\nThe error was: \n\n" + errorThrown);
        },
        complete: function () { $('#wait').hide(); }
    });

}

pm.nz.FetchPlotFromCenter = function () {

    var lat = pm.gMap.getCenter().lat().toFixed(8).toString();
    var lng = pm.gMap.getCenter().lng().toFixed(8).toString();

    pm.nz.GetParcelData(lat, lng);
};

pm.map1.rcListener = pm.G.event.addListener(pm.gMap, 'rightclick', function (e) {
    //console.log(e.latLng);
    //e.stopPropagation();
    var latLng = e.latLng;
    var lat = latLng.lat();
    var lng = latLng.lng();
    pm.nz.GetParcelData(lat, lng);

});

pm.iw.LoadContent = function (event) {
    pm.tempIwData = event;
    var poly = pm.plots[pm.currentPid];

    if(poly.address){
        var heading = poly.address;
    } else {
        var heading = "Parcel Data"
    }

    if (poly.local) {
        var local = poly.local;
    } else {
        var local = poly.ld;
    }

    var contentString = "<div class='iwDiv'><h3 class='iwHeading'>" + heading + "</h3><small class='iwAddress'>" + local + "</small><br />";
    contentString += "Property ID:  " + poly.pid + "<br />";
    contentString += "Lot:  " + poly.appellation + "<br />";
    contentString += "Titles:  " + poly.titles + "<br />";
    contentString += "AREA:  " + Math.floor(poly.area) + " <small>(square meters)</small><br /></div>";

    pm.iw.setContent(contentString);
    pm.iw.setPosition(event.latLng);
    pm.iw.open(pm.gMap);
}

pm.marker.iconOrange = 'http://maps.google.com/mapfiles/marker_orange.png';
pm.marker.iconGreen = 'http://maps.google.com/mapfiles/marker_green.png';

pm.marker.bbox = new google.maps.LatLngBounds;

pm.marker.Set = function (pid) {

    var plot = pm.plots[pid];
    plot.marker = new pm.G.Marker({
        position: plot.center,
        icon: pm.marker.iconGreen,
        map: pm.gMap2
    });
    pm.marker.bbox.extend(plot.center);
    pm.gMap2.setZoom(15);
    pm.gMap2.fitBounds(pm.marker.bbox);

    google.maps.event.addListener(plot.marker, 'click', function () {

        pm.gMap.setCenter(plot.center);
        $('select#selectPids').val(plot.pid);
        if (pm.currentPid) {
            pm.SetOrange(pm.currentPid);
        }
        pm.SetGreen(plot.pid);
        pm.currentPid = plot.pid;
        //pm.oldPid = plot.pid; // TODO get rid of this logic
    });

    $('div#miniMap div#crosshairsDiv2').hide();
}

pm.marker.Remove = function () {
    gMap.map2Marker.setMap();
    gMap.map2Marker = null;
    $('div#miniMap div#crosshairsDiv2').show();
}

$('#fetchPlotCenterBtn').click(function () {
    pm.nz.FetchPlotFromCenter();
});

$('#selectPids').change(function () {
    var pid = $(this).val();
    var newBbox = pm.plots[pid].bbox;

    pm.iw.close();
    pm.gMap.fitBounds(newBbox);
    pm.gMap2.setCenter(pm.plots[pid].center);
    var tempZoom = pm.gMap.getZoom();
    if (tempZoom >= 19) {
        pm.gMap.setZoom(18);
    }
    if (pm.currentPid) {
        pm.SetOrange(pm.currentPid);
    }
    pm.SetGreen(pid);
    pm.currentPid = pid;
});

$('button#clearPid').click(function () {
    var r = confirm("Are your SURE you want to delete the CURRENT PID?");
    if (r == true) {
        pm.iw.close();
        var currentPidOption = $('select#selectPids option:selected');
        if (currentPidOption.length !== 0) {
            // var currentPid = currentPidOption.val();
            pm.plots[pm.currentPid].setMap();
            pm.plots[pm.currentPid].marker.setMap();
            delete pm.plots[pm.currentPid];
            currentPidOption.remove();
            pm.currentPid = null;
        } else { alert("No PID was selected") }
    }
})

$('button#clearPidAll').click(function () {
    var r = confirm("Are your SURE you want to delete ALL the PIDs from the pm.gMap?");
    if (r == true) {
        pm.iw.close();
        $.each(pm.plots, function (key, value) {
            pm.plots[key].setMap();
            pm.plots[key].marker.setMap();
            delete pm.plots[key];
        });
        pm.marker.bbox = null;
        pm.marker.bbox = new google.maps.LatLngBounds;
        pm.currentPid = null;
        $('#selectPids option').remove();
    }
})

//console.log("JS Loaded")
