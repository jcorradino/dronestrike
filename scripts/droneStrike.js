var strikes = new Array();

var width = $(window).width(),
	height = $(window).height();

var svg = d3.select('body').append('svg')
	.attr('width', width+"px")
	.attr('height', height+"px");
	
var projection = d3.geo.equirectangular()
	.scale((width/640)*400)
	.translate([width/2, height/2])
	.center([55, 20])
			
var path = d3.geo.path()
	.projection(projection);
	
queue()
	.defer(d3.json, "scripts/world-110m2.json")
	.defer(d3.tsv, "scripts/world-country-names.tsv")
	.await(ready);
		
function ready(error, world, names) {
	var land = topojson.feature(world, world.objects.land),
		countries = topojson.feature(world, world.objects.countries).features,
		borders = topojson.mesh(world, world.objects.countries, function(a, b) { return a !== b; }),
		i = -1,
		n = countries.length;

	countries = countries.filter(function(d) {
		return names.some(function(n) {
			if (d.id == n.id) return d.name = n.name;
		});
	}).sort(function(a, b) {
		return a.name.localeCompare(b.name);
	});

	$(countries).each(function(country){
		svg.insert('path', ".graticule")
			.datum(countries[country])
			.attr("class", "land "+ this.name)
			.attr('d', path)
	});
	
	$.ajax({
		url: 'http://api.dronestre.am/data',
		dataType: 'jsonp',
		cache: true
	}).done(function(droneStrikes){
		$(droneStrikes.strike).each(function(){
			this.civsClean = parseInt((this.civilians.indexOf("-") != -1) ? this.civilians.split("-")[1] : (this.civilians === "") ? 0 : this.civilians);
			this.civsClean = isNaN(this.civsClean) ? 0 : this.civsClean;
			this.militantsClean = parseInt(this.deaths_max) - (this.civsClean / 2)  // svg stroke has an annoying "feature" of center-aligning on the border, meaning we need to add at least half of the civilians
			if (!isNaN(this.militantsClean)) {
				var classes = buildCasualtyClasses(this); // To-do: use values object above to avoid redundancy
				var coordinates = projection([this.lon, this.lat]);
				var strike = svg.append("circle")
					.attr("cx", coordinates[0])
					.attr("cy", coordinates[1])
					.attr("r", this.militantsClean)
					.attr("class", buildCasualtyClasses(this))
					.attr("stroke-width", this.civsClean)
					.style("display", "none");
				strikes.push([strike[0], this]);
			}
		});
		$(".playLoader").hide();
		$(".instructions").slideDown();
		$(".playButton").show();
	});
	
	svg.append("line").attr("id", "h_crosshair") // horizontal cross hair
		.attr("x1", 0)
		.attr("y1", 0)
		.attr("x2", 0)
		.attr("y2", 0)
		.style("stroke", "red")
		.style("stroke-width", "1px")
		.style("opacity", .3);

	svg.append("line").attr("id", "v_crosshair") // vertical cross hair
		.attr("x1", 0)
		.attr("y1", 0)
		.attr("x2", 0)
		.attr("y2", 0)
		.style("stroke", "red")
		.style("stroke-width", "1px")
		.style("opacity", .3);

}

$(document).ready(function() {
	var strikeCounter = 0;
	function animateStrikes() {
		if (strikes.length >= strikeCounter) {
			var strike = strikes[strikeCounter];
			var dx = $(strike[0]).attr("cx") - 300,
				dy = $(strike[0]).attr("cy") - 300,
				x = ($(strike[0]).attr("cx") + 300) / 2,
				y = ($(strike[0]).attr("cy") + 300) / 2,
				scale = .9 / Math.max(dx / width, dy / height),
				translate = [width / 2 - scale * x, height / 2 - scale * y];
			svg.transition()
				.duration(250)
				.attr("transform", "translate(" + translate + ")scale(" + scale + ")");
			addCrossHair($(strike[0]).attr("cx"), $(strike[0]).attr("cy"), strike[1]);
			$(strike[0]).attr("r", 0).attr("stroke-width",0).show();
			$(strike[0]).animate({r:strike[1].militantsClean}, {duration: 150, complete: function() {
				$(strike[0]).animate({x:strike[1].civsClean}, {duration: 150, step: function(now) {
					$(this).attr("stroke-width", now);
				}, complete: function() {
					var title = (strike[1].town) ? strike[1].town+", "+strike[1].country : strike[1].country;
					var subtitle = (strike[1].location) ? strike[1].location : "";
					var coords = strike[1].lat+", "+strike[1].lon;
					var summary = strike[1].narrative;
					var top = Math.floor($(strike[0]).attr("cy")) + 15;
					var left = Math.floor($(strike[0]).attr("cx")) + 15;
					if (left + 400 > width) {
						left = width - 425;
					} else if (left < 0) {
						left = 25;
					}
					$("#strikeInformation .strikeTitle").text(title);
					$("#strikeInformation .strikeSecondaryTitleline").text(subtitle);
					$("#strikeInformation .strikeCoords").text(coords);
					$("#strikeInformation .strikeSummary").text(summary);
					$("#strikeInformation").css({top:top + "px", left:left + "px"});
					$("#strikeInformation").slideDown(150, function(){
						$(this).delay(5000).slideUp(150, function() {
							$(strike[0]).fadeTo(150, .1, function() {
								strikeCounter++;
								animateStrikes();
							});
						})
					});
				}});
			}});
			
		}
	};
	$(".playButton").on('click', function() {
		$(".playButton").hide();
		$(".instructions").slideUp();
		animateStrikes();
	});
});

// Add specificity to the API information to add the ability to toggle between different views
function buildCasualtyClasses(strike) {
	var classes = "deaths";
	var civs = (strike.civilians.indexOf("-") != -1) ? strike.civilians.split("-")[1] : strike.civilians;
	var totalDeaths = strike.deaths_max;
	var children = (strike.children.indexOf("-") != -1) ? strike.children.split("-")[1] : strike.children;
	if (civs == 0) {
		classes += " no-civilians";
	} else if (civs / totalDeaths > .5) {
		classes += " mostly-civilians";
	} else if (civs == totalDeaths) {
		classes += " all-civilians";
	}
	return classes;
}

function addCrossHair(xCoord, yCoord, data) {
	// Update horizontal cross hair
	d3.select("#h_crosshair")
		.transition()
		.attr("x1", 0)
		.attr("y1", yCoord)
		.attr("x2", width)
		.attr("y2", yCoord)
		.style("display", "block");
	
	// Update vertical cross hair
	d3.select("#v_crosshair")
		.transition()
		.attr("x1", xCoord)
		.attr("y1", 0)
		.attr("x2", xCoord)
		.attr("y2", height)
		.style("display", "block");
}