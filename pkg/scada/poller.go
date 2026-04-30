package scada

import (
	"context"
	"log"
	"sync"
	"time"
)

// Register layout on the ESP32 (MicroPython, Slave ID 2, starting at address 0):
//   Reg 0: Temperature × 10  (e.g. 230 → 23.0 °C)
//   Reg 1: Humidity × 10     (e.g. 380 → 38.0 %)
//   Reg 2: Gas ADC            (0–4095, raw)
//   Reg 3: Water level ADC    (0–4095, raw)
//   Reg 4: Distance cm        (999 = out of range)
//   Reg 5: IR sensor          (0 = clear, 1 = detected)
//   Reg 6: Flame sensor       (1 = clear/HIGH, 0 = flame detected/LOW — active-low module)
const (
	regCount   = 7
	regTempX10 = 0
	regHumX10  = 1
	regGas     = 2
	regWater   = 3
	regDist    = 4
	regIR      = 5
	regFlame   = 6
)

// SensorData holds a single decoded reading from the ESP32.
type SensorData struct {
	Temperature float64 `json:"temperature"` // °C
	Humidity    float64 `json:"humidity"`    // %
	Gas         int     `json:"gas"`         // raw ADC
	Water       int     `json:"water"`       // raw ADC
	Distance    int     `json:"distance"`    // cm (999 = max range)
	IR          bool    `json:"ir"`          // true = object detected
	Flame       bool    `json:"flame"`       // true = flame detected (inverted: reg=0 means flame)
}

// PollState is the current snapshot returned by the poller.
type PollState struct {
	Connected bool       `json:"connected"`
	Timestamp time.Time  `json:"timestamp"`
	Sensors   SensorData `json:"sensors"`
	Host      string     `json:"host"`
	Port      int        `json:"port"`
	UnitID    int        `json:"unit_id"`
	Error     string     `json:"error,omitempty"`
}

// Config parameterises the Modbus connection and poll rate.
type Config struct {
	Host     string
	Port     int
	UnitID   byte
	Interval time.Duration // default 1s
}

// Poller continuously reads sensor registers and caches the latest state.
type Poller struct {
	cfg   Config
	mu    sync.RWMutex
	state PollState
}

// NewPoller creates a Poller. Call Run() in a goroutine to start polling.
func NewPoller(cfg Config) *Poller {
	if cfg.Interval == 0 {
		cfg.Interval = time.Second
	}
	return &Poller{
		cfg: cfg,
		state: PollState{
			Host:   cfg.Host,
			Port:   cfg.Port,
			UnitID: int(cfg.UnitID),
		},
	}
}

// Run polls the ESP32 on cfg.Interval until ctx is cancelled.
func (p *Poller) Run(ctx context.Context) {
	log.Printf("[SCADA] Poller starting → %s:%d unit=%d interval=%s",
		p.cfg.Host, p.cfg.Port, p.cfg.UnitID, p.cfg.Interval)

	ticker := time.NewTicker(p.cfg.Interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Printf("[SCADA] Poller stopped")
			return
		case <-ticker.C:
			p.poll()
		}
	}
}

// State returns a snapshot of the most recent poll result.
func (p *Poller) State() PollState {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.state
}

func (p *Poller) poll() {
	regs, err := ReadHoldingRegisters(p.cfg.Host, p.cfg.Port, p.cfg.UnitID, 0, regCount)

	p.mu.Lock()
	defer p.mu.Unlock()

	p.state.Timestamp = time.Now().UTC()
	p.state.Host = p.cfg.Host
	p.state.Port = p.cfg.Port
	p.state.UnitID = int(p.cfg.UnitID)

	if err != nil {
		p.state.Connected = false
		p.state.Error = err.Error()
		return
	}

	p.state.Connected = true
	p.state.Error = ""
	p.state.Sensors = SensorData{
		Temperature: float64(int16(regs[regTempX10])) / 10.0,
		Humidity:    float64(regs[regHumX10]) / 10.0,
		Gas:         int(regs[regGas]),
		Water:       int(regs[regWater]),
		Distance:    int(regs[regDist]),
		IR:          regs[regIR] != 0,
		// Flame sensor is active-low: register=0 means flame detected
		Flame: regs[regFlame] == 0,
	}
}
