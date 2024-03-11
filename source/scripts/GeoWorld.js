class GeoWorld {
    constructor() {
        this.divID = "world";
        this.width = 100;
        this.height = 100;

        this.svgGlobe = null;
        this.scale = 1;
        this.rotate = 60;
        this.maxlat = 83;

        this.topo = null; // topo data
        this.places = null; // place dots
        
        this.path = null; // path to refresh svgGlobe
        this.proj = null; // projection to modify path
    
        this.interval = null;

        this.debug = false;
        this.zoomable = true;
        this.dragable = true;
        this.dragMouse = [0, 0];
        this.dragPoint = [0, 0];

        this.selectedCountryID = 0;
    }
    
    init() {
        // init d3
        var div = document.getElementById(this.divID);
        this.width = div.offsetWidth;
        this.height = div.offsetHeight;

        // root svgGlobe to refresh all paths
        this.svgGlobe = d3.select("#" + this.divID)
            .append("svg")
            .attr("width", this.width)
            .attr("height", this.height);

        // projection used for globe
        this.proj = d3.geoMercator()
            .translate([this.width / 2, this.height / 2])
            .scale((this.width - 1) / 2 / Math.PI);

        // setup zoom events
        if (this.zoomable) {
            var zoomCall = d3.zoom()
                .scaleExtent([1, 8])
                .on("zoom", () => this.moveWorld());
            this.svgGlobe.call(zoomCall);
        }

        // refresh path used for globe
        this.path = d3.geoPath().projection(this.proj);
    }
    
    // ============================================================
    async load() {
        await this.loadTopo();
        await this.loadPlaces();
        await this.loadFlights();
    }

    async loadTopo() {
        // load required topo json data
        this.topo = await d3.json("/data/topo/50m.json");
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
            .curve(this.flightCurve);
        
        var flights = [];
        for(var i=0;i < this.flights.length - 1; i++) {
            flights.push({ 
                source: this.proj([ this.flights[i].lng, this.flights[i].lat]),
                target: this.proj([ this.flights[i+1].lng, this.flights[i+1].lat])
            });
        }

          // build geoJSON features from links array
          var lines = [];
          flights.forEach(function(e) {
                var feature = { "type": "LineString", "coordinates": [e.source, e.target] }
                lines.push(feature)
            })

            this.svgGlobe.selectAll(".flight").remove();
            this.svgGlobe
                .data(lines)
                .enter()
                .append("path")
                .attr("class", "flight")
                .attr("d", (d) => { return d.path; })
                .exit();
    }

    flightCurve(context) {
        var custom = d3.curveLinear(context);
        custom._context = context;
        custom.point = function(x,y) {
          x = +x, y = +y;
          switch (this._point) {
            case 0: this._point = 1; 
              this._line ? this._context.lineTo(x, y) : this._context.moveTo(x, y);
              this.x0 = x; this.y0 = y;        
              break;
            case 1: this._point = 2;
            default: 
              var x1 = this.x0 * 0.5 + x * 0.5;
              var y1 = this.y0 * 0.5 + y * 0.5;
              var m = 1/(y1 - y)/(x1 - x);
              var r = -100; // offset of mid point.
              var k = r / Math.sqrt(1 + (m*m) );
              if (m == Infinity) {
                y1 += r;
              }
              else {
                y1 += k;
                x1 += m*k;
              }     
              this._context.quadraticCurveTo(x1,y1,x,y); 
              this.x0 = x; this.y0 = y;        
              break;
          }
        }
        return custom;
      }

    showPlaces() {
        var circle = d3.geoCircle();
        this.svgGlobe.selectAll(".geoplace").remove();
        this.svgGlobe.selectAll(".geoplace")
            .data(this.places)
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

    // ============================================================
    // update svg with data
    refresh() {
        this.svgGlobe.selectAll("path").attr("d", this.path);
        this.showPlaces();
        this.showFlights();
    }

    moveWorld() {
        this.svgGlobe
            .selectAll("path")
            .attr("transform", d3.event.transform);
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
        if (r != this.proj.center() || k != iT.k)
        {
            d3.transition()
                .duration(750)
                .tween("animate", 
                    () => {
                        var iK = d3.interpolate(iT.k, k);
                        var iR = d3.interpolate(this.proj.center(), r);
                        return (i) => {
                            iT.k = iK(i);
                            this.svgGlobe.attr("transform", iT);
                            this.proj.center(iR(i));
                            this.refresh();
                        };
                    });
                //.on("end", () => this.tourPlaces());
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
            this.animate(this.proj.center(), 1);
        }
    }

    clearCountry() {
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
            this.animate([lng, lat], scale);
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