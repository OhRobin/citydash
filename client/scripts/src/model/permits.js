/*
 * PermitsCollection
 */
define(
    ["backbone", "underscore", "leaflet", "permit", "ref-location", "config", "utils"],
    function(B, _, L, Permit, refLocation, config, $u) {
        console.log("Creating Permits collection.");

        return B.Collection.extend({
            model: Permit,

            url: config.pzURL,

            comparator: false,

            selection: null,

            initialize: function() {
                this.listenTo(refLocation, "change", this.updateRadiusFilter);
                this.on("change:selected", this.permitSelected);
            },

            fetch: function(opts) {
                this.trigger("fetching", this, opts);
                return B.Collection.prototype.fetch.call(this, opts);
            },

            /**
             * @param {String} name
             * @param {Boolean} desc true to sort descending
             */
            sortByField: function(name, desc) {
                var order = desc ? -1 : 1;
                this.sortField = name;
                this.order = order;

                if (!name) {
                    this.comparator = false;
                } else {
                    this.comparator = function(p1, p2) {
                        var v1 = p1.get(name),
                            v2 = p2.get(name);

                        return order * ((v1 > v2) ? 1 : (v2 > v1) ? -1 : 0);
                    };
                    this.sort();
                }
            },

            /*
             * Applies each of the functions in the array fs to the
             * permits in the collection. If any of the functions
             * returns false, the Permit will be updated: its "excluded"
             * attribute will be set to true.
             */
            applyFilters: function(fs) {
                var count = this.length;
                this.each(function(permit) {
                    var excluded = permit.get("excluded"),
                        shouldExclude = !$u.everyPred(fs, permit);

                    // Is the permit already excluded, and should it be?
                    if (excluded !== shouldExclude) {
                        permit.set("excluded", shouldExclude);
                    }
                    if (shouldExclude) --count;
                });

                this.trigger("filtered", count);
            },

            // A map of string filter names to functions
            activeFilters: {},

            // Reapply all of the active filters.
            refresh: function() {
                this.applyFilters(_.values(this.activeFilters));
            },

            addFilter: function(name, f) {
                this.activeFilters[name] = f;
                this.refresh();
            },

            removeFilter: function(name) {
                delete this.activeFilters[name];
                this.refresh();
            },

            filterByDescription: function(regex) {
                if (regex) {
                    this.addFilter("search", function(permit) {
                        return !!(regex.exec(permit.get("description")));
                    });
                } else {
                    this.removeFilter("search");
                }
            },

            filterByDescriptionString: function(s) {
                var r = s && new RegExp(s.replace(/([?.*\\()[])/g, "\\$1"), "i");
                this.filterByDescription(r);
            },

            filterByRadius: function(refPoint, radius) {
                if (refPoint && radius) {
                    this.addFilter("radius", function(permit) {
                        var location = permit.get("location");

                        return location &&
                            L.latLng(location).distanceTo(refPoint) <= radius;
                    });
                } else {
                    this.removeFilter("radius");
                }
            },

            clearRadiusFilter: function() {
                this.removeFilter("radius");
            },

            /*
             * @param {Array} spga
             */
            filterByAuthority: function(spga) {
                if (spga) {
                    this.addFilter("spga", function(permit) {
                        return _.contains(spga, permit.get("spga"));
                    });
                } else {
                    this.removeFilter("spga");
                }
            },

            filterByTypes: function(types) {
                if (types) {
                    this.addFilter("types", function(permit) {
                        return _.contains(types, permit.get("permit"));
                    });
                } else {
                    this.removeFilter("types");
                }
            },

            updateRadiusFilter: function(loc) {
                var r = loc.getRadiusMeters();
                if (r) {
                    this.filterByRadius(loc.getPoint(), r);
                } else {
                    this.clearRadiusFilter();
                }
            },

            // Returns a LatLngBounds object for the permits that are
            // not excluded.
            getBounds: function() {
                return L.latLngBounds(_.map(this.where({excluded: false}),
                                            function(p) {
                                                return p.get("location");
                                            }));
            },

            // Called when a child permit has its "selected" attribute
            // set. Clears the existing selection.
            permitSelected: function(permit, selected) {
                if (this.selected && this.selected != permit)
                    this.selected.set("selected", false);

                this.selected = permit;
            }
        });
    });
