class Globe {
    divWorld = null; // main html element    
    svgWorld = null; // root svg image
    
    topoWorld = null; // topo data cache
    worldFeature = null; // topo feature cache

    pathEarth = null; // path to render SVG
    projEarth = null; // projection to modify path

    visitedCountires = [858, 392, 124, 10, 32, 76, 152, 36, 40, 56, 156, 250, 276, 344, 356, 372, 380, 388, 484, 496, 528, 554, 643, 702, 724, 826, 840];

    space = null;
    width = null;
    height = null;
    scale = null;

    constructor() {
    }
    
    async loadWorld() {
        // load required topo json data
        this.topoWorld = await d3.json("/data/topo/world.json");

        // render countries on globe
        this.worldFeature = topojson.feature(this.topoWorld, this.topoWorld.objects.countries);
        this.svgWorld.on("click", (d) => this.clickCountry(d));
        this.svgWorld.selectAll(".geocountry")
            .data(this.worldFeature.features)
            .enter()
            .insert("path")
            .attr("d", this.pathEarth)
            .attr("id", (d) => "g" + d.id)
            .attr("class", (d) => this.styleCountry(d))
            .on("mouseover", (d) => this.hoverCountry(d))
            .on("click", (d) => this.clickCountry(d));
    }

    initGlobe() {
        // init d3
        this.space = document.getElementById("space");
        this.width = this.space.offsetWidth;
        this.height = this.space.offsetHeight;
        var minSize = (this.height < this.width ? this.height : this.width);
        this.scale = (minSize / 2);

        // root SVG to render all paths
        this.svgWorld = d3.select("#earth")
            .append("svg")
            .attr("width", this.width)
            .attr("height", this.height);

        // setup drag events
        var dragCall = d3.drag()
            .on("start", () => this.dragWorld(true))
            .on("drag", () => this.dragWorld(false))
            //.on("end", function () {});
        this.svgWorld.call(dragCall);

        // setup zoom events
        var zoomCall = d3.zoom()
            //.duration(1000)
            //.wheelDelta(() => (-0.1 * d3.event.deltaY))
            .on("zoom", () => this.zoomWorld());
        this.svgWorld.call(zoomCall)
            .on("wheel.zoom", null) // disable wheel zoom
            .on("dblclick.zoom", null); // disable double click

        // projection used for globe
        this.projEarth = d3.geoOrthographic()
            .translate([this.width / 2, this.height / 2])
            .clipAngle(90)
            .scale(this.scale);

        // render path used for globe
        this.pathEarth = d3.geoPath().projection(this.projEarth); //.pointRadius(2);

        // projection used for flights = globe * 1.25 to offset arcs above surface
        /*
        var projFlights = d3.geoOrthographic()
            .translate([width / 2, height / 2])
            .clipAngle(90)
            .scale(scale * 1.25);
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
            this.dragPoint = this.projEarth.rotate();
        }
        else {
            var x = mouse[0] - this.dragMouse[0];
            var y = mouse[1] - this.dragMouse[1];
            var point = [this.dragPoint[0] + (mouse[0] - this.dragMouse[0]) / 4, this.dragPoint[1] + (this.dragMouse[1] - mouse[1]) / 4];
            this.projEarth.rotate([point[0], point[1]]);
            this.renderWorld();
        }
    }

    zoomWorld() {
        transform(d3.event.transform.k);
    }

    zoomTo(level) {
        var transform = d3.zoomTransform(this.svgWorld);
        transform.k = level;
        this.svgWorld.attr("transform", transform);
    }



    styleCountry(d) {
        return "geocountry" + (this.visitedCountires.includes(parseInt(d.id)) ? " geovisited" : "");
    }

    hoverCountry(d) {
        //document.getElementById("title").innerHTML = "Country #" + d.id;
    }

    activeCountry = 0;
    clickCountry(d) {
        // prevent default click handler
        d3.event.stopPropagation();
        if (d) {
            // set selection
            this.activeCountry = d.id;
            // find x/y center of object
            var c = this.pathEarth.centroid(d);
            // map x/y to lat/lon
            var i = this.projEarth.invert(c);
            // invert for rotation
            this.projEarth.rotate([-i[0], -i[1]]);
            // refresh render            
            this.renderWorld();
            // zoom in
            this.zoomTo(2);
            // log out
            console.log(this.activeCountry);
        }
        else {
            // clear selection
            this.activeCountry = 0;
            // reset zoom level
            this.zoomTo(1);
        }
    }

    renderWorld() {
        this.svgWorld.selectAll(".geocountry").attr("d", this.pathEarth);
    }
}