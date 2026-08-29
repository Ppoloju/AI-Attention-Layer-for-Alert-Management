-- Seed data for testing purposes
-- This file contains sample events for development and testing

INSERT INTO events (source, event_type, service, severity, message, metadata, occurred_at) VALUES
('github', 'pull_request', 'payment-api', 'high', 'Payment API deployment health check failed', '{"repository": "demo/repo", "action": "opened"}', NOW() - INTERVAL '1 hour'),
('prometheus', 'alert', 'auth-service', 'critical', 'High error rate detected in authentication service', '{"error_rate": "0.95", "endpoint": "/login"}', NOW() - INTERVAL '30 minutes'),
('slack', 'incident', 'user-service', 'medium', 'Users reporting slow response times', '{"affected_users": 150, "region": "us-east"}', NOW() - INTERVAL '15 minutes');
