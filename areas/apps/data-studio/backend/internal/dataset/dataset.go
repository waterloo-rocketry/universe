package dataset

type Sample struct {
	Time  float64 `json:"time"`
	Value float64 `json:"value"`
}
type Series struct {
	SourceID  string   `json:"sourceId"`
	ChannelID string   `json:"channelId"`
	Unit      string   `json:"unit"`
	TimeBasis string   `json:"timeBasis"`
	Samples   []Sample `json:"samples"`
}
type Dataset struct {
	Name       string   `json:"name"`
	Provenance string   `json:"provenance"`
	Warnings   []string `json:"warnings"`
	Series     []Series `json:"series"`
}
