$(document).ready(function () {
	$("#parseButton").click(function () {
		var example = window.ReverseRegexThing.parse($("#regex").val());
		$("<div class=\"regexExample\" />").text(example).prependTo($("#exampleOutput"));
	});
	
	if (window.location.search) {
		var getItems = window.location.search.substr(1).split('&');
		var getParameters = {};
		for (var i = 0; i < getItems.length; i++) {
			var keyVal = getItems[i].split('=');
			getParameters[keyVal[0]] = keyVal[1];
		}
		
		if (getParameters["pattern"]) {
			$("#regex").val(decodeURIComponent(getParameters["pattern"]));
		}
	}
});
