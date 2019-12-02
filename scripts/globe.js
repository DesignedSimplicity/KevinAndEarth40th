class Globe {
    visitedCountires = [858, 392, 124, 10, 32, 76, 152, 36, 40, 56, 156, 250, 276, 344, 356, 372, 380, 388, 484, 496, 528, 554, 643, 702, 724, 826, 840];

    // container
    divID = "earth";
    width = null;
    height = null;
    
    // SVG image
    svgGlobe = null;
    scale = null;
    
    topo = null; // topo data cache
    countries = null; // topo feature cache

    path = null; // path to render svgGlobe
    proj = null; // projection to modify path

    zoomable = false;
    dragable = true;
    selectedCountryID = 0;

    constructor() {
    }
    
    async load() {
        // load required topo json data
        this.topo = await d3.json("/data/topo/world.json");

        // render countries on globe
        this.countries = topojson.feature(this.topo, this.topo.objects.countries);
        this.svgGlobe.on("click", (d) => this.clickCountry(d));
        this.svgGlobe.selectAll(".geocountry")
            .data(this.countries.features)
            .enter()
            .insert("path")
            .attr("d", this.path)
            .attr("id", (d) => "geocountry" + d.id)
            .attr("class", (d) => this.styleCountry(d))
            .on("mouseover", (d) => this.hoverCountry(d))
            .on("click", (d) => this.clickCountry(d));
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
                .on("start", () => this.dragWorld(true))
                .on("drag", () => this.dragWorld(false))
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
        /*
        var projFlights = d3.geoOrthographic()
            .translate([this.width / 2, this.height / 2])
            .clipAngle(90)
            .scale(this.scale * 1.25);
        */
    }

    // drag globe
    dragMouse = [0, 0];
    dragPoint = [0, 0];
    dragWorld(start) {
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
            this.renderWorld();
        }
    }

    // zoom to scale
    zoomTo(scale) {
        var transform = d3.zoomTransform(this.svgGlobe);
        transform.k = scale;
        this.svgGlobe.attr("transform", transform);
    }

    // ============================================================
    // country selection methods
    styleCountry(d) {
        return "geocountry" + (this.visitedCountires.includes(parseInt(d.id)) ? " geovisited" : "");
    }

    hoverCountry(d) {
        //document.getElementById("title").innerHTML = "Country #" + d.id;
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
            // reset zoom level
            this.zoomTo(1);
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
            // invert for rotation
            this.proj.rotate([-c.lng, -c.lat]);
            // refresh render            
            this.renderWorld();
            // zoom in
            this.zoomTo(2);
        }
    }

    renderWorld() {
        this.svgGlobe.selectAll(".geocountry").attr("d", this.path);
    }
}