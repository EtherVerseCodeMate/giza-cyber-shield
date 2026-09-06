package main

import (
	"log"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/agi"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/dag"
)

func main() {
	log.Println("Initializing KASA (Khepra Agentic Security Auditor)...")
	
	// Initialize the persistent DAG for KASA
	store := dag.GlobalDAG()
	engine := agi.NewEngine(store)
	
	log.Println("Adding tasks to KASA to get some reps...")
	engine.AddTask("Routine Perimeter Sweep", "Eban")
	engine.AddTask("Dependency Vulnerability Hunt", "OwoForoAdobe")
	
	log.Println("Starting KASA Engine in Guardian Mode...")
	engine.Start()
	
	// Wait for KASA to process the tasks
	log.Println("Letting KASA run for 2 minutes to process the queue...")
	time.Sleep(2 * time.Minute)
	
	log.Println("Stopping KASA Engine...")
	engine.Stop()
	log.Println("KASA evaluation complete.")
}
