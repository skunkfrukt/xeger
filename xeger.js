(function () {

	var Range = function (min, max) {
		if (this.min > this.max) {
			throw "Invalid range: " + min + ", " + max;
		}
		this.min = (typeof min === "number" ? min : min.charCodeAt());
		this.max = (typeof max === "number" ? max : max.charCodeAt());
	};

	Range.prototype.expand = function() {
		var values = [];

		for (var i = this.min; i <= this.max; i++) {
			values.push(i);
		}

		return values;
	};

	window.Range = Range;

	var CharacterClass = function (isPositive /*...*/) {
		this.isPositive = isPositive;
		this.items = {};
		this.size = (isPositive ? 0 : 65536);

		for (var i = 1; i < arguments.length; i++) {
			this.add(arguments[i]);
		}
	};

	CharacterClass.prototype.add = function (item) {
		if (typeof item === "string") {
			this.items[item.charCodeAt(0)] = true;
		} else if (typeof item === "number") {
			this.items[item] = true;
		} else if (item instanceof Range) {
			var chars = item.expand();
			for (var i = 0; i < chars.length; i++) {
				this.items[chars[i]] = true;
			}
		} else if (item instanceof CharacterClass) {
			var chars = item.getAllCharCodes();
			for (var i = 0; i < chars.length; i++) {
				this.items[chars[i]] = true;
			}
		}

		this.size = (this.isPositive ? Object.keys(this.items).length : 65536 - Object.keys(this.items).length);
	};

	CharacterClass.prototype.getAllCharCodes = function () {
		if (this.isPositive) {
			return Object.keys(this.items);
		} else {
			var charCodes = [];
			for (var i = 0; i < 65536; i++) {
				if (!this.items[i]) {
					charCodes.push(i);
				}
			}
			return charCodes;
		}
	};

	CharacterClass.prototype.inverse = function () {
		return new CharacterClass(!this.isPositive, this);
	};

	CharacterClass.prototype.getRandomCharacter = function () {
		var randomIndex = Math.floor(Math.random() * this.size);
		if (this.isPositive) {
			var randomCharCode = Object.keys(this.items).sort()[randomIndex];
			return String.fromCharCode(randomCharCode);
		} else {
			var excludedCharCodes = Object.keys(this.items).sort(function (a, b) { return a - b });
			for (var i = 0; i < excludedCharCodes.length; i++) {
				if (excludedCharCodes[i] <= randomIndex) {
					randomIndex++;
				} else {
					break;
				}
			}
			return String.fromCharCode(randomIndex);
		}
	};

	window.WILDCARD_CLASS = new CharacterClass(false);  // Negative class excluding nothing. Not confusing at all.
	window.DIGIT_CLASS = new CharacterClass(true, new Range('0', '9'));
	window.NON_DIGIT_CLASS = window.DIGIT_CLASS.inverse();
	window.WORD_CLASS = new CharacterClass(true, new Range('A', 'Z'), new Range('a', 'z'), new Range('0', '9'), '_');
	window.NON_WORD_CLASS = window.WORD_CLASS.inverse();
	window.WHITESPACE_CLASS = new CharacterClass(true, '\f', '\n', '\r', '\t', '\v', '\u00a0', '\u1680', '\u180e',
		new Range('\u2000', '\u200a'), '\u2028', '\u2029', '\u202f', '\u205f', '\u3000', '\ufeff');
	window.NON_WHITESPACE_CLASS = window.WHITESPACE_CLASS.inverse();

	window.CharacterClass = CharacterClass;

	var ReverseRegexThing = new function () {
		this.REGEX_TOKEN_REGEX = /\\u\{[0-9A-Fa-f]{1,4}\}|\\u[0-9A-Fa-f]{4}|\\x[0-9A-Fa-f]{2}|\\c[A-Z]|\\[0-3][0-7]{2}|\\[^cux]|\((?:\?.)?|\)|\||\^|\$|\[\^?(?:\\.|[^\]])+\]|[\?\*\+][\?\+]?|\{\d+(?:,(?:\d+))?\}|\.|[^\\\.\?\*\+\(\)\{\}\[\]\^\$\|]+/g;
		this.BRACE_QUANTIFIER_REGEX = /^\{\d+(?:,(?:\d+))?\}$/;
		this.BRACKET_SUBTOKEN_REGEX = /\\u[0-9A-Fa-f]{4}|\\x[0-9A-Fa-f]{2}|\\c[A-Z]|\\[0-3][0-7]{2}|\\.|[^\]\\]/g;

		// Since some of the quantifiers permit arbitrarily large numbers, let's pick a reasonably big one and go with that.
		this.PSEUDOINFINITY = 100;
		
		this.parse = function (regex) {
			var tokens = regex.match(this.REGEX_TOKEN_REGEX);
			var structure = this.parseStructure(tokens, 0, 0).structure;
			var example = this.generateExample(structure);
			var actualRegex = new RegExp(regex);
			if (!actualRegex.test(example)) {
				throw "Example " + example + " does not match regex " + actualRegex;
			}
			return example;
		};
		
		this.parseStructure = function(tokenArray, startIndex, parenthesisLevel) {
			var structure = {tokenType: "or", operands: [{tokenType: "and", operands: []}]};
			var substructure = structure.operands[0];
			
			for (var i = startIndex; i < tokenArray.length; i++) {
				var token = tokenArray[i];
				if (token[0] === "(") {
					var innerStructure = this.parseStructure(tokenArray, i + 1, parenthesisLevel + 1);
					substructure.operands.push(innerStructure.structure);
					i = innerStructure.lastIndex;
				} else if (token === ")" && parenthesisLevel > 0) {
					return {structure: structure, lastIndex: i};
				} else {
					var parsedToken = this.parseToken(token);
					if (parsedToken.tokenType === "pipe") {
						substructure = {tokenType: "and", operands: []};
						structure.operands.push(substructure);
					} else if (parsedToken.tokenType === "quantifier") {
						var modifiedToken = substructure.operands[substructure.operands.length - 1];
						if (modifiedToken.tokenType === "literal" && modifiedToken.content.length > 1) {
							var newToken = {
								tokenType: "literal",
								content: modifiedToken.content[modifiedToken.content.length - 1],
								quantifier: parsedToken
							};
							modifiedToken.content = modifiedToken.content.substring(0, modifiedToken.content.length - 1);
							substructure.operands.push(newToken);
						} else {
							modifiedToken.quantifier = parsedToken;
						}
					} else {
						substructure.operands.push(parsedToken);
					}
				}
			}
			
			if (parenthesisLevel > 0) throw "Unclosed parenthesis in expression!!!11";

			structure = this.flatten(structure);
			return {structure: structure, lastIndex: null};
		};
		
		this.parseToken = function (inToken) {
			switch (inToken[0]) {
				case '|':
					return {tokenType: "pipe"};
				case '[':
					return this.parseBracketClass(inToken);
				case '\\':
					return this.parseEscapedCharacter(inToken);
				case '?':
				case '*':
				case '+':
				case '{':
					return this.parseQuantifier(inToken);
				case '^':
					return {tokenType: "anchor", position: "start"};
				case '$':
					return {tokenType: "anchor", position: "end"};
				case '.':
					return {tokenType: "characterClass", characterClass: window.WILDCARD_CLASS};
				default:
					return {tokenType: "literal", content: inToken};
			}	
		};

		this.parseBracketClass = function (inToken) {
			var subTokens = inToken.substring(1, inToken.length - 1).match(this.BRACKET_SUBTOKEN_REGEX);
			var outToken = {tokenType: "characterClass", characterClass: new CharacterClass(true)};

			var parsedSubtokens = []
			for (var i = 0; i < subTokens.length; i++) {
				var subtoken = subTokens[i];
				if (subtoken === '^' && i === 0) {
					outToken.characterClass.isPositive = false;
				} else if (subtoken === '-' && parsedSubtokens.length > 0 && i < subTokens.length - 1) {
					var rangeMin = parsedSubtokens.pop();
					if (rangeMin instanceof CharacterClass || rangeMin instanceof Range) {
						throw "Trying to use a class or a range as a boundary value of another range.";
					}
					var rangeMax = this.parseBracketClassSubtoken(subTokens[i + 1]);
					if (rangeMax instanceof CharacterClass) {
						throw "Trying to use a class as a boundary value of a range."
					}
					parsedSubtokens.push(new Range(rangeMin, rangeMax));
					i++;
				} else {
					parsedSubtokens.push(this.parseBracketClassSubtoken(subtoken));
				}
			}

			for (var i = 0; i < parsedSubtokens.length; i++) {
				outToken.characterClass.add(parsedSubtokens[i]);
			}

			return outToken;
		};

		this.parseBracketClassSubtoken = function (inToken) {
			if (inToken.length === 1) {
				return inToken;
			} else if (inToken[0] === '\\') {
				if (inToken[1] === 'b') {
					return '\u0008';  // Backspace
				}

				var parsedSubtoken = this.parseEscapedCharacter(inToken);

				if (parsedSubtoken.tokenType === "literal") {
					return parsedSubtoken.content;
				} else if (parsedSubtoken.tokenType === "characterClass") {
					return parsedSubtoken.characterClass;
				} else {
					throw "Invalid token in character class: " + inToken + ", tokenType: " + parsedSubtoken.tokenType;
				}

			} else {
				throw "wtf";
			}
		};

		this.parseOctalCharacterEscape = function (inToken) {
			return String.fromCharCode(parseInt(inToken.substring(2, 5), 8));
		};

		this.parseHexCharacterEscape = function (inToken) {
			return String.fromCharCode(parseInt(inToken.substring(2, 4), 16));
		};

		this.parseUnicodeCharacterEscape = function (inToken) {
			if (inToken[2] === '{') {
				var hexCharCode = inToken.match(/\{([0-9A-Fa-f]{1,4})\}/)[1];
			} else {
				var hexCharCode = inToken.substring(2, 6);
			}
			return String.fromCharCode(parseInt(hexCharCode, 16));
		};

		this.parseControlCharacterEscape = function (inToken) {
			var charCode = inToken.charCodeAt(2) - 64;
			return String.fromCharCode(charCode);
		};

		this.parseQuantifier = function (inToken) {
			var outToken = {tokenType: "quantifier"};

			switch (inToken[0]) {
				case '?':
					outToken.min = 0;
					outToken.max = 1;
					break;
				case '*':
					outToken.min = 0;
					outToken.max = this.PSEUDOINFINITY;
					break;
				case '+':
					outToken.min = 1;
					outToken.max = this.PSEUDOINFINITY;
					break;
				case '{':
					if (!this.BRACE_QUANTIFIER_REGEX.test(inToken)) throw "That's a stupid quantifier and you're stupid, stupid.";
					
					// TODO Add some fuck*ng error handling here. :\
					var subTokens = inToken.match(/,|[0-9]+/g);
					outToken.min = parseInt(subTokens[0]);
					switch (subTokens.length) {
						case 1:
							outToken.max = parseInt(subTokens[0]);
							break;
						case 2:
							outToken.max = this.PSEUDOINFINITY;
							break;
						case 3:
							outToken.max = parseInt(subTokens[2]);
							break;
					}
					break;
				default:
					throw "Invalid quantifier, somehow: " + inToken;
			}

			if (inToken.length > 1) {
				switch (inToken[inToken.length - 1]) {
					case '?':
						outToken.lazy = true;
						break;
					case '+':
						outToken.greedy = true;
						break;
				}
			}

			return outToken;
		};
		
		this.parseEscapedCharacter = function (inToken) {
			switch (inToken[1]) {
				case '0':
					if (inToken.length === 2) {
						return {tokenType: "literal", content: '\0'};
					}
				case '1':
				case '2':
				case '3':
					return {tokenType: "literal", content: this.parseOctalCharacterEscape(inToken)};
				case 'b':
					return {tokenType: "anchor", position: "word-boundary"};
				case 'B':
					return {tokenType: "anchor", position: "non-word-boundary"};
				case 'c':
					return {tokenType: "literal", content: this.parseControlCharacterEscape(inToken)};
				case 'd':
					return {tokenType: "characterClass", characterClass: window.DIGIT_CLASS};
				case 'D':
					return {tokenType: "characterClass", characterClass: window.NON_DIGIT_CLASS};
				case 'f':
					return {tokenType: "literal", content: '\f'};
				case 'n':
					return {tokenType: "literal", content: '\n'};
				case 'r':
					return {tokenType: "literal", content: '\r'};
				case 's':
					return {tokenType: "characterClass", characterClass: window.WHITESPACE_CLASS};
				case 'S':
					return {tokenType: "characterClass", characterClass: window.NON_WHITESPACE_CLASS};
				case 't':
					return {tokenType: "literal", content: '\t'};
				case 'u':
					return {tokenType: "literal", content: this.parseUnicodeCharacterEscape(inToken)};
				case 'v':
					return {tokenType: "literal", content: '\v'};
				case 'w':
					return {tokenType: "characterClass", characterClass: window.WORD_CLASS};
				case 'W':
					return {tokenType: "characterClass", characterClass: window.NON_WORD_CLASS};
				case 'x':
					return {tokenType: "literal", content: this.parseHexCharacterEscape(inToken)};
				case 'Z':
					return {tokenType: "anchor", position: "end"};
				default:
					return {tokenType: "literal", content: inToken[1]};
			}
		};

		this.flatten = function (structure) {
			var outStructure = structure;
			while (outStructure.operands && outStructure.operands.length === 1 && !outStructure.quantifier) {
				outStructure = outStructure.operands[0];
			}
			if (outStructure.operands) {
				for (var i = 0; i < outStructure.operands.length; i++) {
					outStructure.operands[i] = this.flatten(outStructure.operands[i]);
				}
			}
			return outStructure;	
		}
		
		this.randomizeQuantifier = function (quantifierToken) {
			var span = quantifierToken.max - quantifierToken.min;
			
			return parseInt(quantifierToken.min) + Math.floor(Math.random() * (span + 1));
		};

		this.generateExample = function (structure) {
			var example = "";
			var quantifier = 1;

			if (structure.quantifier) {
				quantifier = this.randomizeQuantifier(structure.quantifier);
			}

			for (var m = 0; m < quantifier; m++) {
				switch (structure.tokenType) {
					case "and":
						for (var i = 0; i < structure.operands.length; i++) {
							example += this.generateExample(structure.operands[i]);
						}
						break;
					case "or":
						var operandIndex = Math.floor(Math.random() * structure.operands.length);
						example += this.generateExample(structure.operands[operandIndex]);
						break;
					case "characterClass":
						example += structure.characterClass.getRandomCharacter();
						break;
					case "literal":
						example += structure.content;
						break;
					default:
						example += structure;
				}
			}
			
			return example;
		};
		
	};
	
	window.ReverseRegexThing = ReverseRegexThing;
}());
