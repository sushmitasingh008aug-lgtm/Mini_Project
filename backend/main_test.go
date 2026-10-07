package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
)

func setupTestApp() *fiber.App {
	initDB()
	app := fiber.New()

	api := app.Group("/api")
	api.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "healthy"})
	})
	api.Get("/metrics", handleGetMetrics)
	api.Get("/tasks", handleGetTasks)
	api.Get("/sections", handleGetSections)
	api.Get("/schedule", handleGetSchedule)
	api.Get("/impact", handleGetImpact)
	api.Get("/schedule/status", handleGenerateStatus)
	api.Post("/tasks/submit", handleSubmitTask)
	api.Get("/tests/status", handleGetTestsStatus)

	return app
}

func TestEvaluateDelays(t *testing.T) {
	blocks := map[string][]placedBlock{
		"SEC_A": {{startMin: 0, endMin: 120}, {startMin: 200, endMin: 300}},
		"SEC_B": {{startMin: 60, endMin: 90}},
	}
	trains := map[string][]trainWindow{
		"SEC_A": {
			{entryMin: 60, exitMin: 80},   // hit by block1 -> delay = 120-60 = 60
			{entryMin: 250, exitMin: 260}, // hit by block2 -> delay = 300-250 = 50
		},
		"SEC_C": {
			{entryMin: 10, exitMin: 20}, // no blocks on SEC_C -> untouched
		},
	}

	collisions, affected, delay := evaluateDelays(blocks, trains)
	if collisions != 2 {
		t.Errorf("Expected 2 collisions, got %d", collisions)
	}
	if affected != 2 {
		t.Errorf("Expected 2 affected journeys, got %d", affected)
	}
	if delay != 110 {
		t.Errorf("Expected total delay 110 minutes, got %d", delay)
	}
}

func TestNaiveScheduleCollidesButOptimizedDoesNot(t *testing.T) {
	tasks := []ScheduledTask{
		{TaskID: "T1", SectionID: "S1", DurationMinutes: 240, PriorityScore: 100},
		{TaskID: "T2", SectionID: "S1", DurationMinutes: 240, PriorityScore: 50},
	}
	trains := map[string][]trainWindow{
		"S1": {{entryMin: 100, exitMin: 140}},
	}

	naive := buildNaiveSchedule(tasks)
	nColl, _, nDelay := evaluateDelays(naive, trains)
	if nColl == 0 || nDelay == 0 {
		t.Errorf("Traffic-blind baseline should collide with trains, got collisions=%d delay=%d", nColl, nDelay)
	}

	actual := buildActualSchedule([]ScheduledTask{
		{TaskID: "T1", SectionID: "S1", StartMinute: 200, EndMinute: 440, PriorityScore: 100},
		{TaskID: "T2", SectionID: "S1", StartMinute: 500, EndMinute: 740, PriorityScore: 50},
	})
	oColl, oAffected, oDelay := evaluateDelays(actual, trains)
	if oColl != 0 || oAffected != 0 || oDelay != 0 {
		t.Errorf("Optimized schedule must have zero impact, got collisions=%d affected=%d delay=%d", oColl, oAffected, oDelay)
	}
}

func TestGetImpactEndpoint(t *testing.T) {
	app := setupTestApp()
	if db == nil || db.Ping() != nil {
		t.Skip("PostgreSQL database not running, skipping DB-dependent impact test")
	}
	req := httptest.NewRequest("GET", "/api/impact", nil)
	resp, err := app.Test(req, 10000)
	if err != nil {
		t.Fatalf("Impact request failed: %v", err)
	}
	// 200 (CSV+DB present) or 404 (schedule not generated yet) are both valid states.
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNotFound {
		t.Errorf("Expected status 200 or 404, got %d", resp.StatusCode)
	}
}

func TestHealthCheck(t *testing.T) {
	app := setupTestApp()
	req := httptest.NewRequest("GET", "/api/health", nil)
	resp, err := app.Test(req, 5000)
	if err != nil {
		t.Fatalf("Health check failed: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}
}

func TestGetMetrics(t *testing.T) {
	app := setupTestApp()
	if db == nil || db.Ping() != nil {
		t.Skip("PostgreSQL database not running, skipping DB-dependent metrics test")
	}
	req := httptest.NewRequest("GET", "/api/metrics", nil)
	resp, err := app.Test(req, 5000)
	if err != nil {
		t.Fatalf("Metrics request failed: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}
}

func TestSubmitTaskSecurityRejections(t *testing.T) {
	app := setupTestApp()

	// 1. Invalid Department Injection Attempt
	badDeptPayload := SubmitTaskRequest{
		Department:       "HackingDept' OR '1'='1",
		TargetSection:    "SEC_BSB_LKO_01",
		TaskType:         "Rail Weld",
		Criticality:      "High",
		DurationMinutes:  90,
		DueDate:          "2026-08-25",
	}
	body, _ := json.Marshal(badDeptPayload)
	req := httptest.NewRequest("POST", "/api/tasks/submit", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, _ := app.Test(req, 5000)
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected status 400 for invalid department, got %d", resp.StatusCode)
	}

	// 2. Out-of-bounds duration (<15 or >720)
	badDurationPayload := SubmitTaskRequest{
		Department:       "Engineering",
		TargetSection:    "SEC_BSB_LKO_01",
		TaskType:         "Rail Weld",
		Criticality:      "High",
		DurationMinutes:  5, // Invalid duration
		DueDate:          "2026-08-25",
	}
	body, _ = json.Marshal(badDurationPayload)
	req = httptest.NewRequest("POST", "/api/tasks/submit", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, _ = app.Test(req, 5000)
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected status 400 for out-of-bounds duration, got %d", resp.StatusCode)
	}

	// 3. Valid Submission
	if db == nil || db.Ping() != nil {
		t.Skip("PostgreSQL database not running, skipping valid DB insertion test")
	}
	validPayload := SubmitTaskRequest{
		Department:       "Engineering",
		TargetSection:    "SEC_BSB_LKO_01",
		TaskType:         "Broken Rail Weld Repair",
		Criticality:      "High",
		DurationMinutes:  90,
		DueDate:          time.Now().AddDate(0, 0, 2).Format("2006-01-02"),
	}
	body, _ = json.Marshal(validPayload)
	req = httptest.NewRequest("POST", "/api/tasks/submit", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, _ = app.Test(req, 5000)
	if resp.StatusCode != http.StatusCreated {
		t.Errorf("Expected status 201 for valid task submission, got %d", resp.StatusCode)
	}
}
