# Reverse RegEx Thing
A tool that takes a regular expression as input and produces a random string that matches it.

## Input

A regular expression containing any of the following (as of v0.0):

* Literals, though these are of course quite uninteresting on their own.
* Escaped metacharacters.
* Subexpressions in the form of capturing or non-capturing groups.
* Character classes, positive or negative. 

## Output

* A string that will hopefully match the supplied regular expression.
