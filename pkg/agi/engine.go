package agi

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/dag"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/intel"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/lorentz"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/scanner"
)

// Objective defines the high-level goal of the AGI
type Objective string

const (
	ObjectiveGuardian Objective = "Protect the integrity of the Khepra Lattice."
	ObjectiveCommando Objective = "Delta Force Mode: Seek and Destroy Threats."
	ObjectiveAuditor  Objective = "Enterprise Risk Elimination (KASA)"
)

// KASA (Khepra Agentic Security Auditor)
// Based on BabyAGI:
// 1. Task List (Khepra DAG)
// 2. Execution Agent (Khepra Core)
// 3. Task Creation Agent (Symbolic Planner)
// 4. Prioritization Agent (Risk Heuristics)

type Engine struct {
	Objective Objective
	Status    string
	Mode      string

	// Task Management
	Tasks []Task

	store   *dag.Memory
	intel   *intel.KnowledgeBase
	scanner *scanner.Scanner

	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

type Task struct {
	ID          string
	Description string
	Priority    string // HIGH, MED, LOW
	Symbol      string // Associated Adinkra Symbol (e.g., Eban)
}

// NewEngine creates a new Khepra AGI Engine
func NewEngine(store *dag.Memory) *Engine {
	ctx, cancel := context.WithCancel(context.Background())
	return &Engine{
		Objective: ObjectiveAuditor,
		Status:    "Initialized",
		Mode:      "KASA-v1",
		store:     store,
		intel:     intel.NewKnowledgeBase(),
		scanner:   scanner.New(),
		ctx:       ctx,
		cancel:    cancel,
		Tasks:     []Task{},
	}
}

// Start begins the cognitive loop
func (e *Engine) Start() {
	e.Status = "Running"
	e.wg.Add(1)
	go e.loop()
	log.Printf("[KASA] Agentic Auditor initialized. Objective: %s", e.Objective)
}

// Stop halts the engine
func (e *Engine) Stop() {
	e.cancel()
	e.wg.Wait()
	e.Status = "Stopped"
	log.Println("[KASA] Agent sleeping.")
}

func (e *Engine) loop() {
	defer e.wg.Done()
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-e.ctx.Done():
			return
		case <-ticker.C:
			e.think()
		}
	}
}

// think is the core BabyAGI-inspired loop
func (e *Engine) think() {
	// If no tasks, we drift or take orders
	if len(e.Tasks) == 0 {
		return
	}

	// 1. Pull highest priority task
	task := e.Tasks[0]
	e.Tasks = e.Tasks[1:] // Pop

	log.Printf("[KASA] EXECUTING TASK: %s (%s)", task.Description, task.Symbol)
	e.Status = "Working on: " + task.Description

	// 2. Execution Agent
	result, err := e.execute(task)
	if err != nil {
		log.Printf("[KASA] FAILURE: %v", err)
		return
	}

	// 3. Log to DAG (Integrity Proof)
	e.logToDAG(task, result)

	// 4. Create New Tasks (Task Creation Agent)
	// In a full BabyAGI, this uses an LLM. Here, we use heuristic logic for now.
	e.deriveNewTasks(task, result)
}

func (e *Engine) execute(t Task) (string, error) {
	// Mock Execution Logic for V1
	time.Sleep(1 * time.Second)
	return fmt.Sprintf("Completed %s. Verified 0 incidents.", t.Description), nil
}

func (e *Engine) logToDAG(t Task, result string) {
	node := dag.Node{
		ID:     fmt.Sprintf("task-%s-%d", t.ID, time.Now().UnixNano()),
		Action: t.Description,
		Symbol: t.Symbol,
		Time:   lorentz.StampNow(),
	}
	// We would attach the 'result' as metadata if the Node struct supported it.
	// For now, the action string captures the intent.
	if err := e.store.Add(&node, []string{}); err == nil {
		log.Printf("[KASA] PROVENANCE SECURED: Node %s", node.ID)
	}
}

func (e *Engine) deriveNewTasks(t Task, result string) {
	// Heuristic Logic: If we scanned port 80, maybe scan port 443?
	if t.Description == "Scan Perimeter" {
		newTask := Task{
			ID:          "task-followup",
			Description: "Verify SSL Certificate",
			Priority:    "HIGH",
			Symbol:      "Eban",
		}
		e.Tasks = append(e.Tasks, newTask)
		log.Printf("[KASA] NEW TASK DERIVED: %s", newTask.Description)
	}
}

// AddTask allows external injection of directives
func (e *Engine) AddTask(description, symbol string) {
	t := Task{
		ID:          fmt.Sprintf("t-%d", time.Now().Unix()),
		Description: description,
		Priority:    "HIGH",
		Symbol:      symbol,
	}
	e.Tasks = append(e.Tasks, t)
	log.Printf("[KASA] TASK INGESTED: %s", description)
}

// RunMission: Scan triggers a vulnerability scan (Commando Capability)
func (e *Engine) RunScan(target string) error {
	e.Status = "Scanning Target: " + target
	log.Printf("[KASA] COMMANDO: Initiating Vulnerability Scan on %s...", target)

	results, err := e.scanner.Run(target)
	if err != nil {
		e.Status = "Scan Failed: " + err.Error()
		return err
	}

	// [DAG]: Record Intelligence to the Constellation
	e.Status = fmt.Sprintf("Processing %d findings...", len(results))

	for _, r := range results {
		// Create a DAG node for each finding
		node := dag.Node{
			// In production, use crypto-secure IDs. Using a simple random here for speed.
			ID:     fmt.Sprintf("scan-%s-%d-%d", r.Target, r.Port, time.Now().UnixNano()),
			Action: fmt.Sprintf("port-open:%d", r.Port),
			Symbol: "Nkyinkyim", // Symbol for Versatility/Initiative
			Time:   lorentz.StampNow(),
			PQC: map[string]string{
				"crypto_agility_score": "0.0",             // Placeholder for V3
				"signature_scheme":     "Dilithium-Mode3", // Self-Assertion
				"risk_horizon":         "Y2Q-Critical",    // Years to Quantum
			},
		}

		// Commit to Immutable Ledger
		if err := e.store.Add(&node, []string{}); err != nil {
			log.Printf("[KASA] ERROR: Failed to write intelligence to DAG: %v", err)
		} else {
			log.Printf("[KASA] INTEL SECURED: %s:%d IS OPEN -> DAG Node %s", r.Target, r.Port, node.ID)
		}
	}

	e.Status = "Scan Complete"
	return nil
}

// GetState returns the current status and objective
func (e *Engine) GetState() map[string]string {
	return map[string]string{
		"status":    e.Status,
		"objective": string(e.Objective),
		"mode":      e.Mode,
	}
}

// Chat handles a conversation message
func (e *Engine) Chat(message string) string {
	// Updated Persona: SouHimBou Commando
	e.AddTask("Process User Directive: "+message, "Sankofa")
	return fmt.Sprintf("COMMANDO MODE ACTIVE. I have analyzed: '%s'. My directives are clear: Seek, Destroy, and Secure the Lattice. Awaiting orders.", message)
}
