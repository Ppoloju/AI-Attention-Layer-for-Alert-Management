-- Seed data for testing purposes
-- This file contains sample events for development and testing

INSERT INTO events (source, event_type, service, severity, timestamp, message, metadata) VALUES
('github', 'pull_request', 'payment-api', 'high', NOW() - INTERVAL '1 hour', 'Payment API deployment health check failed', '{"repository": "demo/repo", "action": "opened"}'),
('prometheus', 'alert', 'auth-service', 'critical', NOW() - INTERVAL '30 minutes', 'High error rate detected in authentication service', '{"error_rate": "0.95", "endpoint": "/login"}'),
('slack', 'incident', 'user-service', 'medium', NOW() - INTERVAL '15 minutes', 'Users reporting slow response times', '{"affected_users": 150, "region": "us-east"}');
