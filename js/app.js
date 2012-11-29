$(document).ready(function(){
  console.log("Hello World from app.js");
  
  var defaultParams = "&format=json&epsg_in=wgs84&epsg_out=wgs84&user="+config.user+"&pass="+config.pass;
  
  initializeMap();
  initializeTimeSelector();
  
  var map;
  var startMarker;
  var endMarker;
  var otherMarkers;
  var polyline;
  var legLinesAndMarkers;
  var directionsDisplay;
  var directionsService = new google.maps.DirectionsService();
  var distance;


  function initializeTimeSelector(){
    var now = new Date();
    //$('#time').val(now.getHours()+":"+now.getMinutes())
    $('#time').scroller({
    	preset: 'time',
    	ampm: false,
    	timeFormat: 'HH:ii',
    	onSelect: function(){
    		$("#now").removeClass("selected");
      		getRoute();
    	}
    });
    $('#now').click(function(){
    	setTimeNow();
    });
    setTimeNow();
  }
  
  function setTimeNow(){
    $('#time').scroller('setDate', new Date(), true);
  	$("#now").addClass("selected");
  }

  function setPositionMarker(position) {
    clearTimeout(etimeout);
    console.log("set position marker");

    // var startDefaultLatLng = new google.maps.LatLng(60.1885493977,24.8339133406);
    var endDefaultLatLng = null;
    
    if (startMarker) {
      startMarker.setMap(null);
    }
    
    var startIcon = new google.maps.MarkerImage("images/your-position-small.png",null,null,new google.maps.Point(10,10));
    console.log(startIcon);
    startMarker = new google.maps.Marker({
      position: new google.maps.LatLng(position.coords.latitude, position.coords.longitude),
      draggable: false,
      title: "Start",
      icon: startIcon
    });
    startMarker.setMap(map);

    var params = "?request=reverse_geocode&limit=1&coordinate="
      + position.coords.longitude + "," + position.coords.latitude;
    console.log(config.api + params + defaultParams);
    $.getJSON(config.api + params + defaultParams, function(data) {
      $("#from").val(data[0].name);
    });
  }

  function errorCallback(error) {
    console.log("something went wrong: " + error + ", using default location...");
    var positionJson = "{\"coords\":{\"latitude\":\"" + config.locs.otaniemi.lat + "\",\"longitude\":\"" + config.locs.otaniemi.lng + "\"}}";
    var position = jQuery.parseJSON(positionJson);
    setPositionMarker(position);
  }

  function initializeMap() {
    var c = config.locs.mapcenter;
    var latlng = new google.maps.LatLng(c.lat, c.lng);

    var customMapType = new google.maps.StyledMapType([
      {
        stylers:[
          { gamma:0.6 }
        ]
      }, {
        featureType:"road.highway",
        elementType:"labels",
        stylers:[
          { visibility:"off" }
        ]
      }, {
        featureType:"water",
        stylers:[
          { lightness:-20 }
        ]
      }, {
        featureType:"poi",
        elementType:"labels",
        stylers:[
          { visibility:"off" }
        ]
      }
    ], {name:"AaltoWindow style"});

    var myOptions = {
      zoom:12,
      maxZoom:16,
      center:latlng,
      streetViewControl:false,
      mapTypeControlOptions:{
        mapTypeIds:[google.maps.MapTypeId.ROADMAP, google.maps.MapTypeId.HYBRID, 'custom']
      }
    };
    map = new google.maps.Map(document.getElementById("map_canvas"), myOptions);

    map.mapTypes.set('custom', customMapType);
    map.setMapTypeId('custom');
    
    if (navigator.geolocation) {
      etimeout = setTimeout(errorCallback, 3000);
      navigator.geolocation.getCurrentPosition(setPositionMarker, errorCallback, {maximumAge:1000});
    }

    otherMarkers = [];
    $.each(config.locs, function (i, loc) {
      if (!("nomap" in loc)) {
        console.log('other location:' + config.locs[i].title);
        var latLng = new google.maps.LatLng(loc.lat, loc.lng);

        //old icon: "https://chart.googleapis.com/chart?chst=d_map_spin&chld=1|0|ffffff|9|b|"+loc.title
        var icon = "https://chart.googleapis.com/chart?chst=d_simple_text_icon_below&chld="
          + loc.title + "|14|fff|" + "star|24|ffff00|333";

        var marker = new google.maps.Marker({
          position:latLng,
          draggable:false,
          title:loc.title,
          zIndex:0,
          icon:icon
        });
        marker.setMap(map);
        google.maps.event.addListener(marker, 'mouseup',
          function () {
            routeTo(latLng);
          }
        );

        otherMarkers.push(marker);
      }
    });

    legLinesAndMarkers = [];

    function LongClick(map, length) {
      this._length = length;
      var me = this;
      me._map = map;
      google.maps.event.addListener(map, 'mousedown', function (e) {
        me._onMouseDown(e)
      });
      google.maps.event.addListener(map, 'mouseup', function (e) {
        me._onMouseUp(e)
      });
    }

    LongClick.prototype._onMouseUp = function (e) {
      var now = +new Date;
      if (now - this._down > this._length) {
        if (Math.abs(e.pixel.x - this._x) < config.longPressThreshold
          && Math.abs(e.pixel.y - this._y) < config.longPressThreshold) {
          google.maps.event.trigger(this._map, 'longpress', e);
        }
      }
    };
    LongClick.prototype._onMouseDown = function (e) {
      this._down = +new Date;
      this._x = e.pixel.x;
      this._y = e.pixel.y;
    };
    new LongClick(map, 300);
    google.maps.event.addListener(map, 'longpress', function (e) {
      routeTo(e.latLng);
    });
    google.maps.event.addListener(map, 'rightclick', function (e) {
      routeTo(e.latLng);
    });
    
    var kutsuplusPolyline = new google.maps.Polyline({
      map: map,
      strokeColor: '#19942E',
      strokeOpacity: 0.7,
      strokeWeight: 7
    });
    // If directionsDisplay uses the kutsuplusPolyline as polylineOptions, some routes are misdisplayed.
    directionsDisplay = new google.maps.DirectionsRenderer({preserveViewport: true, draggable: false, suppressMarkers: true});
    directionsDisplay.setMap(map);
  }

  function routeTo(latLng) {
    console.log("routeTo " + latLng);
    if (!endMarker && toSelected())
      addEndMarker(latLng);

    var coords = String(latLng).replace("(", "").replace(")", "").split(", ");
    var params = "?request=reverse_geocode&limit=1&coordinate=" + coords[1] + "," + coords[0];
    $.getJSON(config.api + params + defaultParams, function(data) {
      if (toSelected()) {
        $("#to").val(data[0].name);
      } else {
        $("#from").val(data[0].name);
      }
      
    });
    if (toSelected()) {
      endMarker.setPosition(latLng);
    }else {
      startMarker.setPosition(latLng);
    }
    
    getRoute();
  }

  function addEndMarker(latLng) {
    console.log("addEndMarker: " + latLng);
    var endIcon = new google.maps.MarkerImage("images/goal.png",null,null,new google.maps.Point(17,52));
    endMarker = new google.maps.Marker({
      position: latLng,
      draggable: true,
      icon: endIcon
    });
    endMarker.setMap(map);
  }

  function initializeSwitches() {
    var switches = $('<div id="map_switches"></div>');
    switches.append('<a id="switch-toggle-other-markers" href="javascript:;">'
        +'Campus markers</a>');
    /*switches.append('<a id="switch-toggle-your-position" href="javascript:;">'
        +'Your position</a>');*/
    $("#map_canvas").append(switches);
    $("#switch-toggle-other-markers").click(function(){
      var isOff = $(this).hasClass("off");
      $.each(otherMarkers, function(i, marker){
        marker.setVisible(isOff);
        if(isOff) {
          $("#switch-toggle-other-markers").removeClass("off");
        } else {
          $("#switch-toggle-other-markers").addClass("off");
        }
      });
    });
    /*$("#switch-toggle-your-position").click(function(){
      var isOff = $(this).hasClass("off");
      startMarker.setVisible(isOff);
      if(isOff) {
        $("#switch-toggle-your-position").removeClass("off");
      } else {
        $("#switch-toggle-your-position").addClass("off");
      }
    });*/
  }

  function getTransportHex(type, variant) {
    color = "";
    switch(type) {
      case "walk": color = "499bff"; break;
      case "tram": color = "00ae2e"; break;
      case "metro": color = "fb6500"; break;
      case "ferry": color = "00aee7"; break;
      case "train": color = "e9001a"; break;
      // bus
      default: color = "193695";
    }

    if (variant === "light") {
      switch(type) {
        case "walk": color = "8dd2ff"; break;
        case "tram": color = "5ee764"; break;
        case "metro": color = "ff9c42"; break;
        case "ferry": color = "69e6ff"; break;
        case "train": color = "ff7d61"; break;
        // bus
        default: color = "5a65cc";
      }
    }
    return color;
  }
  function getIconType(type) {
    switch(type) {
      case "tram": return "train";
      case "metro": return "train";
      case "ferry": return "ship";
      default: return type;
    }
  }

  function createPolyline(path, transportTypeString) {
    if(!path) {
      path = [];
      console.log("No path!");
    }

    var color = "#"+getTransportHex(transportTypeString);

    polyline = new google.maps.Polyline({
        path: path,
        strokeColor: color,
        strokeOpacity: 0.9,
        strokeWeight: 5,
        clickable: false
      });
    polyline.setMap(map);

    return polyline;
  }
  function createMarker(LatLng, vehicle, type) {
    var color = getTransportHex(type);
    var icontype = getIconType(type);

    //old icon: "https://chart.googleapis.com/chart?chst=d_map_spin&chld=1|0|"+color+"|11|b|"+vehicle

    var marker = new google.maps.Marker({
      position: LatLng,
      draggable: false,
      title: vehicle+"",
      icon: "https://chart.googleapis.com/chart?chst=d_simple_text_icon_below&chld="+vehicle+"|16|fff|"
        +icontype+"|16|"+color+"|333"
    });
    marker.setMap(map);
    return marker;
  }

  function showRoute(legs) {
    console.log("showRoute");
    // remove any current lines
    for(var i in legLinesAndMarkers) {
      legLinesAndMarkers[i]["polyline"].setMap(null);
      if(legLinesAndMarkers[i]["marker"]) {
        legLinesAndMarkers[i]["marker"].setMap(null);
      }
      legLinesAndMarkers[i] = null;
    }
    legLinesAndMarkers = [];

    for(var i in legs) {
      var leg = legs[i];
      var type = getLegTypeString(leg.type);
      var marker = null;
      if (type !== "walk") {
        var vehicleNumber = formatVehicleCode(leg.code,type);
        marker = createMarker(
          new google.maps.LatLng(leg.locs[0].coord.y,leg.locs[0].coord.x), vehicleNumber, type
        );
      }
      var path = [];
      $.each(leg.shape,function(i,shape){
        path.push(new google.maps.LatLng(shape.y,shape.x))
      });
      var line = createPolyline(path, type);

      legLinesAndMarkers.push({polyline: line, marker: marker});
    }
  }

  function formatVehicleCode(code,type) {
    //console.log('code:'+code);
    var vehicleString = "";
    if (type === "train") {
      vehicleString = " " + code.substring(4,5);
    } else if (type === "metro") {
      vehicleString = "";
    } else {
      vehicleString = code.substring(1,6).trim();
      var leadingZeros = 0;
      for (var i in vehicleString) {
        if(vehicleString[i] === "0") {
          leadingZeros++;
        } else {
          break;
        }
      }
      vehicleString = " " + vehicleString.substring(leadingZeros);
    }

    return vehicleString;
  }

  function getRoute() {
    console.log("getRoute");
    
    if(!startMarker || !endMarker){
    	return false;
    }
    
    $("#loader").fadeIn();
    
    // Clear current data
    $("#results").empty();
    showRoute({});

    var fromLatLng = startMarker.getPosition();
    var from = fromLatLng.lng() + "," + fromLatLng.lat();
    //console.log("from:"+from)
    
    var toLatLng = endMarker.getPosition();
    var to = toLatLng.lng() + "," + toLatLng.lat();
    //console.log("to:"+to)

    var time = $("#time").val().replace(":","");

    var params = "?request=route&from="+from+"&to="+to+"&time="+time+"&detail=full";

    $.getJSON(config.api+params+defaultParams, function(data){
      $("#loader").fadeOut();
      if (data && data[0]) {
        $.each(data, function(i,val){
          var route = val[0];
          var routePath= [];
          var walkingLength = 0;

          console.log(route);
          var result = $("<div class='result'></div>");
          //if ()
          //result.append("<h3>"+(i+1)+"</h3>");
          var startTime = route.legs[0].locs[0].depTime;
          var endTime = route.legs[route.legs.length-1].locs[route.legs[route.legs.length-1].locs.length-1].arrTime;
          var routeLength = Math.round(route.length/100)/10;
          result.append("<div class='startTime'>Departure " + startTime.substr(8,2) + ":" + startTime.substr(10,2) + "</div>");
          result.append("<div class='details'>Length " + routeLength + " km, Duration " + route.duration/60
            + " mins<span id='walk-" + i +"'></span></div>");
          result.append("<div class='endTime'>Arrival " + endTime.substr(8,2) + ":" + endTime.substr(10,2) + "</div>");
          /*
          result.append("<h4>"
              +startTime.substr(8,2)+":"+startTime.substr(10,2)
              +"&ndash;"
              +endTime.substr(8,2)+":"+endTime.substr(10,2)
              +" ("+route.duration/60 + " mins)"
              +"</h4>");
          */

          var legs = $("<span class='legs'></span>").appendTo(result);

          $.each(route.legs, function(j,leg){
            if (j > 0) {
              legs.append(" >> ");
            }

            var time = leg.locs[0].depTime;
            //legs.append(time.substr(8,2)+":"+time.substr(10,2) + " ");
            var legElement = $("<span class='leg'></span>");
            var type = getLegTypeString(leg.type);
            if (type === "walk") {
              //legElement.html("Walk, " + leg.length + " m");
              legElement.html("Walk");
              walkingLength += leg.length;
            } else {
              legElement.html(type.charAt(0).toUpperCase() + type.slice(1) + formatVehicleCode(leg.code,type));
            }
            legs.append(legElement);
            legElement.click(function(event){
              if ($(this).parent().parent().hasClass("selected")) {
                var legPath = [];
                legPath.push(new google.maps.LatLng(leg.locs[0].coord.y, leg.locs[0].coord.x));
                legPath.push(new google.maps.LatLng(leg.locs[leg.locs.length - 1].coord.y, leg.locs[leg.locs.length - 1].coord.x));
                // console.log(legPath);
                zoomMapToCoordinates(legPath);
                return false;
              }
            });

            $.each(leg.shape,function(z,loc){
              routePath.push(new google.maps.LatLng(loc.y,loc.x))
            });
          });

          result.find("span#walk-" + i).html(", Walking " + metersToKilometers(walkingLength) + " km");

          //result.append("Length: " + route.length + "m<br/>");
          //result.append("Duration: " + route.duration/60 + " minutes");
          $("#results").append(result);
          zoomMapToCoordinates(routePath);
          // Show route on map when clicked
          result.click(function(){
            if (!$(this).hasClass("selected")) {
              // console.log(routePath);
              zoomMapToCoordinates(routePath);
              showRoute(route.legs);
              $(".result").removeClass("selected");
              result.addClass("selected");
            }
          });

          // Show the first result immediately
          if(i === 0){
            showRoute(route.legs);
            result.addClass("selected")
          }
        });
        $.each($("span.legs"), function(i, legs) {
          // console.log("legs: " + $(this).width() + " with font-size: " + $(this).css("font-size"));
          while ($(this).width() > ($(this).parent().width() * 0.9)) {
            $(this).css("font-size", $(this).css("font-size").match(/^([0-9]+)/)[0] - 1 + "px");
          }
          // console.log("legs: " + $(this).width() + " with font-size: " + $(this).css("font-size"));
        });
      } else {
        $("#results").html("<h2>No routes!</h2>");
      }
    });
    var request = {
        origin:startMarker.getPosition(),
        destination:endMarker.getPosition(),
        travelMode: google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: true
    };
    directionsService.route(request, function(result, status) {
      if (directionsDisplay != null) {
        directionsDisplay.setDirections({routes: []});
      }
      if (status == google.maps.DirectionsStatus.OK) {
        result.routes = result.routes.sort(function(route1,route2) {return route1.legs[0].distance.value - route2.legs[0].distance.value});
        directionsDisplay.setDirections(result);
        distance = result.routes[0].legs[0].distance.text;
        console.log("Route length: " + distance);
      }
    });

    //Show kutsuplus dummy data
    hours = $('#time').scroller("getDate").getHours();
    minutes = $('#time').scroller("getDate").getMinutes();
    timestr = hours + ":" + minutes;
    console.log(timestr);
    buttonstr = '<button id="orderkutsu"> Order </button>';
    $("#kutsuplus").html("<h2> Matkatarjoukset </h2> <p> Price: Dummy </p> <p> Distance: " + distance + " <p> Departure: " + timestr  + " </p> <p> Arrival: Dummy </p>" + buttonstr);
  }
  
  function getLegTypeString(typeId){
    switch(typeId){
      case "walk": return "walk"; break;
      case "2": return "tram"; break;
      case "6": return "metro"; break;
      case "7": return "ferry"; break;
      case "12": return "train"; break;
      default: return "bus";
    } 
  }

  function zoomMapToCoordinates(latLngArray) {
    var bounds = new google.maps.LatLngBounds();
    for (var i = 0; i < latLngArray.length; i++) {
      bounds.extend(latLngArray[i]);
    }
    map.fitBounds(bounds);
  }

  function initializeTimeChooser() {
    console.log("timeChooser");

    $("body").append("<div id='overlay'></div>").append("<div id='time-chooser'></div>");

  }
  
  function metersToKilometers(meters) {
    return Math.round(meters/100)/10;
  }
  
  $("#otaniemi").click(function () {
    lat = 60.186982;
    lng = 24.827256;
    dest = new google.maps.LatLng(lat, lng);
    routeTo(dest);
  });
  
  $("#taik").click(function () {
    lat = 60.20875;
    lng = 24.97562;
    dest = new google.maps.LatLng(lat, lng);
    routeTo(dest);
  });
  
  $("#kauppa").click(function () {
    lat = 60.172058;
    lng = 24.923424;
    dest = new google.maps.LatLng(lat, lng);
    routeTo(dest);
  });
  
  $("#sidebar").hammer({prevent_default:true}).bind("swipe", function (ev) {
    console.log("Dragged time");
    if (ev.direction == "right") {
      newDate = $('#time').scroller("getDate");
      newDate.setMinutes(newDate.getMinutes() + 5);
      currentTime = new Date();
      if (newDate.getMinutes() === currentTime.getMinutes() && newDate.getHours() === currentTime.getHours()) {
        $("#now").addClass("selected");
      } else {
        $("#now").removeClass("selected");
      }
      $('#time').scroller('setDate', newDate, true);

    }
    if (ev.direction == "left") {
      newDate = $('#time').scroller("getDate");
      newDate.setMinutes(newDate.getMinutes() - 5);
      currentTime = new Date();
      if (newDate.getMinutes() === currentTime.getMinutes() && newDate.getHours() === currentTime.getHours()) {
        $("#now").addClass("selected");
      } else {
        $("#now").removeClass("selected");
      }
      $('#time').scroller('setDate', newDate, true);
    }
    getRoute();
  });
  
  $(".fromdiv").hammer().bind("tap", function (ev) {
    $(this).addClass("selected");
    $("#from").addClass("selected");
    $(".todiv").removeClass("selected");
    $("#to").removeClass("selected");
  });
  
  $(".todiv").hammer().bind("tap", function (ev) {
    $(this).addClass("selected");
    $("#to").addClass("selected");
    $(".fromdiv").removeClass("selected");
    $("#from").removeClass("selected");
  });
  
  function toSelected() {
    return $(".todiv").hasClass("selected");
  }
  
});
