$(document).ready(function () {
	//window.rrt = new window.ReverseRegexThing();
	$("#parseButton").click(function () {
		var example = window.ReverseRegexThing.parse($("#regex").val());
		$("<div class=\"regexExample\" />").text(example).prependTo($("#exampleOutput"));
	});
});