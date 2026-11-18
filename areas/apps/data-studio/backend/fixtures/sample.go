// Package fixtures embeds the synthetic smoke dataset so packaged apps work offline.
package fixtures

import _ "embed"

//go:embed sample.json
var Sample []byte
