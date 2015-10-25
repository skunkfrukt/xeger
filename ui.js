$(document).ready(function () {
	$("#parseButton").click(function () {
		var example = window.ReverseRegexThing.parse($("#regex").val());
		$("<div class=\"regexExample\" />").text(example).prependTo($("#exampleOutput"));
	});
});