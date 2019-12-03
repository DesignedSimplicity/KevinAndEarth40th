class GeoWorld {
    // container
    divID = "earth";
    width = null;
    height = null;
    
    // SVG image
    svgGlobe = null;
    scale = null;
    
    topo = null; // topo data
    places = null; // place dots
    flights = null; // flight arcs

    path = null; // path to render svgGlobe
    proj = null; // projection to modify path

    zoomable = false;
    dragable = true;
    debug = false;

    selectedCountryID = 0;

    constructor() {
    }
    
    init() {
        // init d3
        var div = document.getElementById(this.divID);
        this.width = div.offsetWidth;
        this.height = div.offsetHeight;
        var minSize = (this.height < this.width ? this.height : this.width);
        this.scale = (minSize / 2);

        // root svgGlobe to render all paths
        this.svgGlobe = d3.select("#" + this.divID)
            .append("svg")
            .attr("width", this.width)
            .attr("height", this.height);

        // setup drag events
        if (this.dragable)
        {
            var dragCall = d3.drag()
                .on("start", () => this.dragGlobe(true))
                .on("drag", () => this.dragGlobe(false))
                //.on("end", function () {});
            this.svgGlobe.call(dragCall);
        }

        // setup zoom events
        if (this.zoomable) {
            var zoomCall = d3.zoom()
                //.duration(1000)
                //.wheelDelta(() => (-0.1 * d3.event.deltaY))
                .on("zoom", () => this.zoomTo(d3.event.transform.k));
            this.svgGlobe.call(zoomCall)
                .on("wheel.zoom", null) // disable wheel zoom
                .on("dblclick.zoom", null); // disable double click
        }

        // projection used for globe
        this.proj = d3.geoOrthographic()
            .translate([this.width / 2, this.height / 2])
            .clipAngle(90)
            .scale(this.scale);

        // render path used for globe
        this.path = d3.geoPath().projection(this.proj); //.pointRadius(2);

        // projection used for flights = globe * 1.25 to offset arcs above surface
        this.projFlights = d3.geoOrthographic()
            .translate([this.width / 2, this.height / 2])
            .clipAngle(90)
            .scale(this.scale * 1.25);
    }
    
    // ============================================================
    async load() {
        this.loadTopo();
        this.loadPlaces();
        this.loadFlights();
    }

    async loadTopo() {
        // load required topo json data
        this.topo = await d3.json("/data/topo/world.json");
        var features = topojson.feature(this.topo, this.topo.objects.countries).features;

        // render countries on globe
        this.svgGlobe.on("click", (d) => this.clickCountry(d));
        this.svgGlobe.selectAll(".geocountry")
            .data(features)
            .enter()
            .insert("path")
            .attr("d", this.path)
            .attr("id", (d) => "geocountry" + d.id)
            .attr("class", (d) => this.styleCountry(d))
            .on("mouseover", (d) => this.hoverCountry(d))
            .on("click", (d) => this.clickCountry(d));
    }

    async loadPlaces() {
        // load places data
        this.places = await d3.json("/data/places.json");
        this.showPlaces();
    }

    async loadFlights() {
        // load flight data
        this.flights = await d3.json("/data/flights.json");
        this.showFlights();
    }

    // ============================================================
    showFlights() {
        var swoosh = d3.line()
            .x(function(d) { return d[0] })
            .y(function(d) { return d[1] })
            .curve(d3.curveCardinal.tension(0.1));
        
        var flights = [];
        for(var i=0;i < this.flights.length - 1; i++) {
            flights.push({ 
                source: [ this.flights[i].lng, this.flights[i].lat],
                target: [ this.flights[i+1].lng, this.flights[i+1].lat]
            });
        }

          // build geoJSON features from links array
          var lines = [];
          flights.forEach(function(e,i,a) {
                var feature =   { "type": "Feature", "geometry": { "type": "LineString", "coordinates": [e.source,e.target] }}
                lines.push(feature)
            })

            this.svgGlobe.selectAll(".flights").remove();
            this.svgGlobe.append("g").attr("class","flights")
            .selectAll("path").data(flights)
            .enter().append("path")
            .attr("class","flight")
            .attr("d", (d) => { return swoosh(this.flying_arc(d)) })
        
          //refresh();
    }

    flying_arc(pts) {
        var source = pts.source,
            target = pts.target;
      
        var mid = this.location_along_arc(source, target, .5);
        var result = [ this.proj(source),
            this.projFlights(mid),
            this.proj(target) ]
        return result;
      }

      location_along_arc(start, end, loc) {
        var interpolator = d3.interpolate(start,end);
        return interpolator(loc)
      }


    showPlaces() {
        var places = this.places.filter(x => x.type == "City" || x.country == this.selectedCountryID);

        var circle = d3.geoCircle();
        this.svgGlobe.selectAll("path.geopoint").remove();
        this.svgGlobe.selectAll("path.geopoint")
            .data(places)
            .enter()
            .append("path")
            .datum((d) => {
                return circle
                    .center([d.lng, d.lat])
                    .radius(d.type.toLowerCase() == "city" ? 0.3 : 0.2)
                    ();
            })
            .attr("class", (d) => {
                switch (d.type.toLowerCase()) {
                    case "city":
                        return "geopoint geocity";
                    default:
                        return "geopoint geoplace";
                }
             })
            .attr("d", this.path);
    }

    // ============================================================
    // update svg with data
    render() {
        this.svgGlobe.selectAll(".geocountry").attr("d", this.path);
        this.showPlaces();
        this.showFlights();
    }

    // drag globe
    dragMouse = [0, 0];
    dragPoint = [0, 0];
    dragGlobe(start) {
        var mouse = [d3.event.sourceEvent.pageX, d3.event.sourceEvent.pageY];
        if (d3.event.sourceEvent.changedTouches != null && d3.event.sourceEvent.changedTouches.length > 0) {
            mouse = [d3.event.sourceEvent.changedTouches[0].pageX, d3.event.sourceEvent.changedTouches[0].pageY];
        }

        if (start) {
            this.dragMouse = mouse;
            this.dragPoint = this.proj.rotate();
        }
        else {
            var x = mouse[0] - this.dragMouse[0];
            var y = mouse[1] - this.dragMouse[1];
            var point = [this.dragPoint[0] + (mouse[0] - this.dragMouse[0]) / 4, this.dragPoint[1] + (this.dragMouse[1] - mouse[1]) / 4];
            this.proj.rotate([point[0], point[1]]);
            
            this.projFlights.rotate([point[0], point[1]]);
            
            this.render();
        }
    }

    // zoom to set scale without animation
    zoomTo(scale) {
        var transform = d3.zoomTransform(this.svgGlobe);
        transform.k = scale;
        this.svgGlobe.attr("transform", transform);
    }

    // rotate and scale animation
    animate(r, k) { // rotate, scale
        var iT = d3.zoomTransform(this.svgGlobe);
        if (r != this.proj.rotate() || k != iT.k)
        {
            d3.transition()
                .duration(750)
                .tween("animate", 
                    () => {
                        var iK = d3.interpolate(iT.k, k);
                        var iR = d3.interpolate(this.proj.rotate(), r);
                        return (i) => {
                            iT.k = iK(i);
                            this.svgGlobe.attr("transform", iT);
                            this.proj.rotate(iR(i));
                            this.render();
                        };
                    });
        }
    }

    // ============================================================
    // country selection methods
    styleCountry(d) {
        return "geocountry" + (geograffiti.isVisitedCountry(parseInt(d.id)) ? " geovisited" : "");
    }

    hoverCountry(d) {
        this.onHoverCountry(d ? geograffiti.getCountry(d.id) : null);
    }

    clickCountry(d) {
        // prevent default click handler
        if (d3.event) {
            d3.event.stopPropagation();
        }        
        if (d) {
            this.selectCountry(d.id);
        }
        else {
            // clear selection            
            this.clearCountry();
            // execute event handler
            this.onSelectCountry();
            // reset zoom level
            this.animate(this.proj.rotate(), 1);
        }
    }

    clearCountry() {
        if (this.selectedCountryID > 0) {
            d3.select("#geocountry" + this.selectedCountryID).classed("selected", false);
            this.selectedCountryID = 0;
        }        
    }

    selectCountry(id) {
        // set selection
        if (this.selectedCountryID != id) {
            this.clearCountry();
            this.selectedCountryID = id;
            d3.select("#geocountry" + id).classed("selected", true);

            // load country data
            var c = geograffiti.getCountry(id);
            this.animate([-c.lng, -c.lat], 2);
            /*
            // invert for rotation
            this.proj.rotate([-c.lng, -c.lat]);
            // render render            
            this.render();
            // zoom in
            this.zoomTo(2);
            */

            // execute event handler
            this.onSelectCountry(c);
        }
    }

    onSelectCountry(country) {
        if (this.debug) console.log("onSelectCountry", country)
    }

    onHoverCountry(country) {
        if (this.debug) console.log("onHoverCountry", country);
    }
}