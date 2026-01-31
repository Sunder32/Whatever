INSERT INTO templates (id, name, description, category, content, is_public, tags, usage_count) VALUES
(
    uuid_generate_v4(),
    'Blank Diagram',
    'Start with a clean canvas',
    'Basic',
    '{"nodes": [], "edges": [], "layers": [{"id": "default", "name": "Default Layer", "visible": true, "locked": false, "opacity": 1.0, "order": 0}]}',
    TRUE,
    ARRAY['blank', 'empty', 'start'],
    0
),
(
    uuid_generate_v4(),
    'Flowchart',
    'Basic flowchart template with common shapes',
    'Business',
    '{
        "nodes": [
            {"id": "start", "type": "ellipse", "position": {"x": 300, "y": 50}, "size": {"width": 120, "height": 60}, "label": "Start", "style": {"fill": "#4CAF50", "stroke": "#2E7D32"}},
            {"id": "process1", "type": "rectangle", "position": {"x": 280, "y": 150}, "size": {"width": 160, "height": 80}, "label": "Process", "style": {"fill": "#2196F3", "stroke": "#1565C0"}},
            {"id": "decision", "type": "diamond", "position": {"x": 280, "y": 280}, "size": {"width": 160, "height": 100}, "label": "Decision?", "style": {"fill": "#FFC107", "stroke": "#FFA000"}},
            {"id": "end", "type": "ellipse", "position": {"x": 300, "y": 430}, "size": {"width": 120, "height": 60}, "label": "End", "style": {"fill": "#F44336", "stroke": "#C62828"}}
        ],
        "edges": [
            {"id": "e1", "source": "start", "target": "process1"},
            {"id": "e2", "source": "process1", "target": "decision"},
            {"id": "e3", "source": "decision", "target": "end"}
        ],
        "layers": [{"id": "default", "name": "Default Layer", "visible": true, "locked": false, "opacity": 1.0, "order": 0}]
    }',
    TRUE,
    ARRAY['flowchart', 'process', 'business'],
    0
),
(
    uuid_generate_v4(),
    'Mind Map',
    'Central topic with branching ideas',
    'Planning',
    '{
        "nodes": [
            {"id": "center", "type": "ellipse", "position": {"x": 350, "y": 250}, "size": {"width": 140, "height": 80}, "label": "Central Idea", "style": {"fill": "#9C27B0", "stroke": "#6A1B9A"}},
            {"id": "branch1", "type": "rectangle", "position": {"x": 100, "y": 100}, "size": {"width": 120, "height": 60}, "label": "Topic 1", "style": {"fill": "#E91E63", "stroke": "#AD1457", "cornerRadius": 10}},
            {"id": "branch2", "type": "rectangle", "position": {"x": 550, "y": 100}, "size": {"width": 120, "height": 60}, "label": "Topic 2", "style": {"fill": "#3F51B5", "stroke": "#283593", "cornerRadius": 10}},
            {"id": "branch3", "type": "rectangle", "position": {"x": 100, "y": 400}, "size": {"width": 120, "height": 60}, "label": "Topic 3", "style": {"fill": "#009688", "stroke": "#00695C", "cornerRadius": 10}},
            {"id": "branch4", "type": "rectangle", "position": {"x": 550, "y": 400}, "size": {"width": 120, "height": 60}, "label": "Topic 4", "style": {"fill": "#FF5722", "stroke": "#BF360C", "cornerRadius": 10}}
        ],
        "edges": [
            {"id": "e1", "source": "center", "target": "branch1"},
            {"id": "e2", "source": "center", "target": "branch2"},
            {"id": "e3", "source": "center", "target": "branch3"},
            {"id": "e4", "source": "center", "target": "branch4"}
        ],
        "layers": [{"id": "default", "name": "Default Layer", "visible": true, "locked": false, "opacity": 1.0, "order": 0}]
    }',
    TRUE,
    ARRAY['mindmap', 'brainstorm', 'ideas', 'planning'],
    0
),
(
    uuid_generate_v4(),
    'Org Chart',
    'Organizational hierarchy structure',
    'Business',
    '{
        "nodes": [
            {"id": "ceo", "type": "rectangle", "position": {"x": 350, "y": 50}, "size": {"width": 140, "height": 60}, "label": "CEO", "style": {"fill": "#1976D2", "stroke": "#0D47A1"}},
            {"id": "cto", "type": "rectangle", "position": {"x": 150, "y": 150}, "size": {"width": 120, "height": 50}, "label": "CTO", "style": {"fill": "#388E3C", "stroke": "#1B5E20"}},
            {"id": "cfo", "type": "rectangle", "position": {"x": 350, "y": 150}, "size": {"width": 120, "height": 50}, "label": "CFO", "style": {"fill": "#388E3C", "stroke": "#1B5E20"}},
            {"id": "coo", "type": "rectangle", "position": {"x": 550, "y": 150}, "size": {"width": 120, "height": 50}, "label": "COO", "style": {"fill": "#388E3C", "stroke": "#1B5E20"}},
            {"id": "dev1", "type": "rectangle", "position": {"x": 80, "y": 250}, "size": {"width": 100, "height": 40}, "label": "Dev Team", "style": {"fill": "#7CB342", "stroke": "#558B2F"}},
            {"id": "dev2", "type": "rectangle", "position": {"x": 220, "y": 250}, "size": {"width": 100, "height": 40}, "label": "QA Team", "style": {"fill": "#7CB342", "stroke": "#558B2F"}}
        ],
        "edges": [
            {"id": "e1", "source": "ceo", "target": "cto"},
            {"id": "e2", "source": "ceo", "target": "cfo"},
            {"id": "e3", "source": "ceo", "target": "coo"},
            {"id": "e4", "source": "cto", "target": "dev1"},
            {"id": "e5", "source": "cto", "target": "dev2"}
        ],
        "layers": [{"id": "default", "name": "Default Layer", "visible": true, "locked": false, "opacity": 1.0, "order": 0}]
    }',
    TRUE,
    ARRAY['orgchart', 'hierarchy', 'organization', 'business'],
    0
),
(
    uuid_generate_v4(),
    'Network Diagram',
    'IT network infrastructure layout',
    'Technical',
    '{
        "nodes": [
            {"id": "internet", "type": "ellipse", "position": {"x": 350, "y": 50}, "size": {"width": 100, "height": 60}, "label": "Internet", "style": {"fill": "#90CAF9", "stroke": "#1565C0"}},
            {"id": "firewall", "type": "rectangle", "position": {"x": 325, "y": 150}, "size": {"width": 150, "height": 50}, "label": "Firewall", "style": {"fill": "#EF5350", "stroke": "#B71C1C"}},
            {"id": "router", "type": "rectangle", "position": {"x": 340, "y": 250}, "size": {"width": 120, "height": 50}, "label": "Router", "style": {"fill": "#66BB6A", "stroke": "#2E7D32"}},
            {"id": "switch", "type": "rectangle", "position": {"x": 340, "y": 350}, "size": {"width": 120, "height": 50}, "label": "Switch", "style": {"fill": "#42A5F5", "stroke": "#1565C0"}},
            {"id": "server1", "type": "rectangle", "position": {"x": 150, "y": 450}, "size": {"width": 100, "height": 50}, "label": "Server 1", "style": {"fill": "#78909C", "stroke": "#37474F"}},
            {"id": "server2", "type": "rectangle", "position": {"x": 350, "y": 450}, "size": {"width": 100, "height": 50}, "label": "Server 2", "style": {"fill": "#78909C", "stroke": "#37474F"}},
            {"id": "server3", "type": "rectangle", "position": {"x": 550, "y": 450}, "size": {"width": 100, "height": 50}, "label": "Server 3", "style": {"fill": "#78909C", "stroke": "#37474F"}}
        ],
        "edges": [
            {"id": "e1", "source": "internet", "target": "firewall"},
            {"id": "e2", "source": "firewall", "target": "router"},
            {"id": "e3", "source": "router", "target": "switch"},
            {"id": "e4", "source": "switch", "target": "server1"},
            {"id": "e5", "source": "switch", "target": "server2"},
            {"id": "e6", "source": "switch", "target": "server3"}
        ],
        "layers": [{"id": "default", "name": "Default Layer", "visible": true, "locked": false, "opacity": 1.0, "order": 0}]
    }',
    TRUE,
    ARRAY['network', 'infrastructure', 'IT', 'technical'],
    0
),
(
    uuid_generate_v4(),
    'Use Case Diagram',
    'UML use case diagram template',
    'Technical',
    '{
        "nodes": [
            {"id": "actor1", "type": "ellipse", "position": {"x": 50, "y": 200}, "size": {"width": 60, "height": 80}, "label": "User", "style": {"fill": "#FFEB3B", "stroke": "#F9A825"}},
            {"id": "system", "type": "rectangle", "position": {"x": 200, "y": 50}, "size": {"width": 400, "height": 400}, "label": "System", "style": {"fill": "#E3F2FD", "stroke": "#1976D2", "strokeWidth": 2}},
            {"id": "uc1", "type": "ellipse", "position": {"x": 300, "y": 100}, "size": {"width": 160, "height": 60}, "label": "Login", "style": {"fill": "#FFFFFF", "stroke": "#424242"}},
            {"id": "uc2", "type": "ellipse", "position": {"x": 300, "y": 200}, "size": {"width": 160, "height": 60}, "label": "View Dashboard", "style": {"fill": "#FFFFFF", "stroke": "#424242"}},
            {"id": "uc3", "type": "ellipse", "position": {"x": 300, "y": 300}, "size": {"width": 160, "height": 60}, "label": "Create Report", "style": {"fill": "#FFFFFF", "stroke": "#424242"}},
            {"id": "uc4", "type": "ellipse", "position": {"x": 300, "y": 400}, "size": {"width": 160, "height": 60}, "label": "Export Data", "style": {"fill": "#FFFFFF", "stroke": "#424242"}}
        ],
        "edges": [
            {"id": "e1", "source": "actor1", "target": "uc1"},
            {"id": "e2", "source": "actor1", "target": "uc2"},
            {"id": "e3", "source": "actor1", "target": "uc3"},
            {"id": "e4", "source": "actor1", "target": "uc4"}
        ],
        "layers": [{"id": "default", "name": "Default Layer", "visible": true, "locked": false, "opacity": 1.0, "order": 0}]
    }',
    TRUE,
    ARRAY['usecase', 'UML', 'requirements', 'technical'],
    0
);
