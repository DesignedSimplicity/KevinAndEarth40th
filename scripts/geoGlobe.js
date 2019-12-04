class GeoGlobe {
    /*
    // container
    divID = "globe";
    width = null;
    height = null;
    
    // SVG image
    svgGlobe = null;
    scale = null;
    
    topo = null; // topo data
    places = null; // place dots

    path = null; // path to refresh svgGlobe
    proj = null; // projection to modify path

    zoomable = false;
    dragable = true;
    debug = false;

    selectedCountryID = 0;
    */
    constructor() {
        this.divID = "globe";
        this.interval = null;

        this.dragable = true;
        this.dragMouse = [0, 0];
        this.dragPoint = [0, 0];
    }
    
    init() {
        // init d3
        var div = document.getElementById(this.divID);
        this.width = div.offsetWidth;
        this.height = div.offsetHeight;
        var minSize = (this.height < this.width ? this.height : this.width);
        this.scale = (minSize / 2);

        // root svgGlobe to refresh all paths
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

        // refresh path used for globe
        this.path = d3.geoPath().projection(this.proj); //.pointRadius(2);
    }
    
    // ============================================================
    async load() {
        await this.loadTopo();
        await this.loadPlaces();
    }

    async loadTopo() {
        // load required topo json data
        this.topo = await d3.json("/data/topo/world.json");
        var features = topojson.feature(this.topo, this.topo.objects.countries).features;

        // refresh countries on globe
        this.svgGlobe.on("click", () => this.clickCountry(null));
        this.svgGlobe.selectAll(".geocountry")
            .data(features)
            .enter()
            .append("path")
            .attr("d", this.path)
            .attr("id", (d) => "geocountry" + d.id)
            .attr("class", (d) => this.styleCountry(d))
            .on("mouseover", (d) => this.hoverCountry(d))
            .on("mouseout", () => this.hoverCountry(null))
            .on("click", (d) => this.clickCountry(d));
    }

    async loadPlaces() {
        // load places data
        this.places = await d3.json("/data/places.json");
        geodata.setPlaces(this.places);
        this.showPlaces();
    }

    // ============================================================
    //interval = null;
    tourClear() {
        // cancel interval
        if (this.interval) {
            window.clearInterval(this.interval);
            this.interval = null;
        }
        // remove previous tour info
        this.svgGlobe.selectAll(".geoiconback").remove();
        this.svgGlobe.selectAll(".geoicon").remove();
        this.svgGlobe.selectAll("text").remove();
    }
    tourPlaces() {
        this.tourClear();
        // tour selected country
        if (this.selectedCountryID > 0)
        {
            var iconSize = 16;
            var scale = d3.zoomTransform(this.svgGlobe).k;
            var scaleSize = iconSize * 2 / scale;
            var places = this.places.filter(x => x.country === this.selectedCountryID);
            var points = [];
            places.forEach(place => {
                var point = this.proj([place.lng, place.lat]);
                points.push({ x: point[0], y: point[1], t:place.type, n: place.name });
            });

            var count = 0; 
            this.interval = window.setInterval(() => {
                // remove previous tour info
                this.svgGlobe.selectAll(".geoiconback").remove();
                this.svgGlobe.selectAll(".geoicon").remove();
                this.svgGlobe.selectAll("text").remove();

                // repeat/break loop if done
                if (count >= places.length) {
                    count = 0;
                }

                // get current point
                var point = points[count];
                var data = [];
                data.push(point);

                // render on map
                this.svgGlobe.selectAll(".geoiconback")
                    .data(data)
                    .enter()
                    .append("circle")
                    .attr("class", "geoiconback")
                    .attr("cx", function (d) { return d.x; })
                    .attr("cy", function (d) { return d.y; })
                    .attr("r", function (d) { return scaleSize / 1.5; });
                this.svgGlobe.selectAll(".geoicon")
                    .data(data)
                    .enter()
                    .append("svg:image")
                    .attr("xlink:href", function (d) { return "/images/places/" + d.t + ".svg"; })
                    .attr("class", "geoicon")
                    .attr("width", scaleSize)
                    .attr("height", scaleSize)
                    .attr("x", function (d) { return d.x - (scaleSize / 2); })
                    .attr("y", function (d) { return d.y - (scaleSize / 2); })
                this.svgGlobe.selectAll("text")
                    .data(data)
                    .enter()
                    .append("text")
                    .text(function (d) { return d.n; })
                    .attr("class", "geolabel")
                    .attr("font-size", scaleSize + "px")
                    .attr("x", function (d) { return d.x; })
                    .attr("y", function (d) { return d.y - (scaleSize / 1.5); });
                
                // increment and wait
                count++;            
            }, 1000);
        }
    }

    showPlaces() {
        var points = [];
        var center = this.proj.rotate();
        var scale = d3.zoomTransform(this.svgGlobe).k;
        if (scale > 1.5) scale = scale / 1.5;
        this.places.forEach(place => {
            var dist = d3.geoDistance(center, [-place.lng, -place.lat]);
            if (dist < 1.57)
            {
                var radius = (place.type == "City" ? 2 : 1) / scale;
                var style = place.type == "City" ? "geocity" : "geoplace";
                var point = this.proj([place.lng, place.lat]);
                points.push({ id: "geoplace" + place.key, x: point[0], y: point[1], r: radius, s: style, c: place.country });
            }
        });
        this.svgGlobe.selectAll("circle").remove();
        this.svgGlobe.selectAll("circle")
            .data(points)
            .enter()
            .append("circle")
            .attr("class", function (d) { return d.s + " geopoint"; })
            .attr("country", function (d) { return d.c; })
			.attr("cx", function (d) { return d.x; })
			.attr("cy", function (d) { return d.y; })
            .attr("r", function (d) { return d.r; })
            .on("mouseover", (d) => this.hoverPlace(d))
            .on("mouseout", () => this.hoverPlace(null))
            .on("click", (d) => this.clickPlace(d));
    }
    /*
    showCitiesAsPath() {
        var cities = this.places.filter(x => x.type == "City");
        var circle = d3.geoCircle();
        this.svgGlobe.selectAll(".geocity")
            .data(cities)
            .enter()
            .append("path")
            .on("mouseover", (d) => this.hoverPlace(d))
            .datum((d) => {
                return circle
                    .center([d.lng, d.lat])
                    .radius(0.3)
                    ();
            })
            .attr("d", this.path)
            .attr("id", (d) => "geoplace" + d.key)
            .attr("class", "geocity");
    }
    showPlacesAsPath() {
        var places = this.places.filter(x => x.country == this.selectedCountryID);
        var circle = d3.geoCircle();
        this.svgGlobe.selectAll(".geoplace").remove();
        this.svgGlobe.selectAll(".geoplace")
            .data(places)
            .enter()
            .append("path")
            .datum((d) => {
                return circle
                    .center([d.lng, d.lat])
                    .radius(0.2)
                    ();
            })
            .attr("class", "geoplace")
            .attr("d", this.path)
            .on("mouseover", (d) => this.hoverPlace(d));
    }
    */

    // ============================================================
    // update svg with data
    refresh() {
        this.svgGlobe.selectAll("path").attr("d", this.path);
        this.showPlaces();
    }

    // drag globe
    //dragMouse = [0, 0];
    //dragPoint = [0, 0];
    dragGlobe(start) {
        // prevent dragging while selected
        if (this.selectedCountryID > 0) {
            return;
        }

        // toggle mouse/touch source
        var mouse = [d3.event.sourceEvent.pageX, d3.event.sourceEvent.pageY];
        if (d3.event.sourceEvent.changedTouches != null && d3.event.sourceEvent.changedTouches.length > 0) {
            mouse = [d3.event.sourceEvent.changedTouches[0].pageX, d3.event.sourceEvent.changedTouches[0].pageY];
        }

        // start or continue drag
        if (start) {
            this.tourClear();
            this.dragMouse = mouse;
            this.dragPoint = this.proj.rotate();
        }
        else {
            var x = mouse[0] - this.dragMouse[0];
            var y = mouse[1] - this.dragMouse[1];
            var point = [this.dragPoint[0] + (mouse[0] - this.dragMouse[0]) / 4, this.dragPoint[1] + (this.dragMouse[1] - mouse[1]) / 4];
            this.proj.rotate([point[0], point[1]]);
            this.refresh();
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
                            this.refresh();
                        };
                    })
                .on("end", () => this.tourPlaces());
        }
    }

    // ============================================================
    // place methods
    hoverPlace(d) {
        if (d && d.id) {
            var key = d.id.replace("geoplace", "");
            var place = geodata.getPlace(key);
            this.onHoverPlace(place);
        }
        else {
            this.onHoverPlace(null);
        }
    }

    clickPlace(d) {
        if (d3.event) {
            d3.event.stopPropagation();
        }
        if (d && d.id) {
            var key = d.id.replace("geoplace", "");
            var place = geodata.getPlace(key);
            this.selectCountry(place.country);
            this.onClickPlace(place);
        }
        else {
            this.onClickPlace(null);
        }
    }

    onClickPlace(place) {
        if (this.debug) console.log("onClickPlace", place);
    }

    onHoverPlace(place) {
        if (this.debug) console.log("onHoverPlace", place);
    }

    // ============================================================
    // country methods
    styleCountry(d) {
        return "geocountry" + (geodata.isVisited(parseInt(d.id)) ? " geovisited" : "");
    }

    hoverCountry(d, over) {
        this.onHoverCountry(d ? geodata.getCountry(d.id) : null);
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
        this.tourClear();
        if (this.selectedCountryID > 0) {
            d3.select("#geocountry" + this.selectedCountryID).classed("selected", false);
            this.selectedCountryID = 0;
            this.showPlaces();
        }        
    }

    selectCountry(id) {
        // set selection
        if (this.selectedCountryID != id) {
            console.log("selectCountry", this.dragable);

            this.clearCountry();
            this.selectedCountryID = id;
            d3.select("#geocountry" + id).classed("selected", true);

            // load country data
            var c = geodata.getCountry(id);
            var dist = d3.geoDistance([c.lngMin, c.latMin], [c.lngMax, c.latMax]);
            var lng = (c.lngMax + c.lngMin) / 2;
            var lat = (c.latMax + c.latMin) / 2;
            var scale = 1.57 / dist;
            if (scale > 4) {
                scale = 4;
            }
            this.animate([-lng, -lat], scale);
            //this.animate([-c.lng, -c.lat], 2);

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