document.getElementById('upload-form').addEventListener('submit', function (e) {
    e.preventDefault();
    const formData = new FormData(this);

    fetch('/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        console.log('Received Data:', data);

        if (data.error) {
            alert(data.error);
            return;
        }

        if (data.nodes && data.nodes.length > 0) {
            populateSourceDropdown(data.nodes, data.edges);
            document.getElementById('node-selection').style.display = 'block';
            visualizeNetwork(data.nodes, data.edges); // Visualize the network
            document.getElementById('upload-status').innerText = "File has been uploaded successfully!";
        } else {
            alert("No nodes found in the CSV file.");
        }
    })
    .catch(error => console.error('Error:', error));
});

function populateSourceDropdown(nodes, edges) {
    const sourceNodeSelect = document.getElementById('source-node');
    sourceNodeSelect.innerHTML = '';

    // Add a default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.text = 'Choose a node';
    defaultOption.disabled = true;
    defaultOption.selected = true;
    sourceNodeSelect.appendChild(defaultOption);
    
    // Populate the dropdown with nodes
    nodes.forEach(node => {
        const option = document.createElement('option');
        option.value = node;
        option.text = node;
        sourceNodeSelect.appendChild(option);
    });

    // When a source node is selected, update the sink nodes
    sourceNodeSelect.addEventListener('change', function() {
        const selectedSource = this.value;
        populateSinkDropdown(selectedSource, edges);
    });
}

function populateSinkDropdown(source, edges) {
    const sinkNodeSelect = document.getElementById('sink-node');
    sinkNodeSelect.innerHTML = '';

    const connectedNodes = edges.filter(edge => edge.source == source || edge.target == source)
                                 .map(edge => edge.source == source ? edge.target : edge.source);

    connectedNodes.forEach(node => {
        const option = document.createElement('option');
        option.value = node;
        option.text = node;
        sinkNodeSelect.appendChild(option);
    });
}

let network; // Store the network instance globally
let addedEdges = new Set(); // Keep track of added edges
let selectedNodes = {}; // To store the selected nodes and results

function visualizeNetwork(nodes, edges) {
    console.log(edges);  // Debugging line to check edge data

    const nodeData = nodes.map(node => ({ id: node, label: `Node ${node}`, color: '#ff9999' })); // Set initial node color
    const edgeData = edges.map(edge => {
        return {
            id: `${edge.source}-${edge.target}`, // Unique ID for each edge
            from: edge.source,
            to: edge.target,
            font: { align: 'top' },
            title: `Weight: ${edge.weight}`, // Display weight as tooltip
            weight: edge.weight // Store weight for use later
        };
    });

    const data = {
        nodes: new vis.DataSet(nodeData),
        edges: new vis.DataSet(edgeData)
    };

    const options = {
        interaction: {
            hover: true,
            zoomView: true,
            dragView: true,
            dragNodes: true
        },
        edges: {
            arrows: 'to',
            color: { color: '#848484' },
            smooth: { type: 'continuous' },
            scaling: {
                min: 1,
                max: 8,
                label: {
                    enabled: true
                }
            },
            shadow: true
        },
        nodes: {
            shape: 'dot',
            size: 15,
            font: {
                size: 14
            },
            borderWidth: 2,
            shadow: true
        },
        physics: {
            enabled: true,
            barnesHut: {
                gravitationalConstant: -2000,
                springLength: 95
            },
            stabilization: {
                iterations: 2500
            }
        },
        manipulation: {
            enabled: false // Disable default manipulation options
        },
        layout: {
            improvedLayout: true
        }
    };

    // Create or update the network visualization
    if (network) {
        network.setData(data);
    } else {
        network = new vis.Network(document.getElementById('network'), data, options);
    }

    // Add event listener for click on edges and nodes
    network.on('click', function (params) {
        if (params.edges.length > 0) {
            const clickedEdgeId = params.edges[0];
            const clickedEdge = data.edges.get(clickedEdgeId);
            showEdgeDetails(clickedEdge);
        } else if (params.nodes.length > 0) {
            const clickedNodeId = params.nodes[0];
            showNodeBetweenness(clickedNodeId, data.edges);
        }
    });

    // Preserve node colors when changing layout
    network.on('stabilizationIterationsDone', function () {
        data.nodes.forEach(node => {
            data.nodes.update({ id: node.id, color: node.color });
        });
    });
}

document.getElementById('calculate-button').addEventListener('click', function() {
    const source = document.getElementById('source-node').value;
    const sinkSelect = document.getElementById('sink-node');
    const sinks = Array.from(sinkSelect.selectedOptions).map(option => option.value);

    if (!source || sinks.length === 0) {
        alert("Please select both source and at least one sink node.");
        return;
    }

    sinks.forEach(sink => {
        const edgeId = `${source}-${sink}`;
        if (addedEdges.has(edgeId)) {
            alert(`Edge ${edgeId} has already been added.`);
        } else {
            const sinkParams = sinks.map(sink => `sink=${sink}`).join('&');
            fetch(`/calculate?source=${source}&${sinkParams}`)
            .then(response => response.json())
            .then(data => {
                console.log(data.results);  // Debugging line to check results data

                if (data.error) {
                    alert(data.error);
                    return;
                }

                // Store selected nodes and results
                if (!selectedNodes[source]) {
                    selectedNodes[source] = [];
                }
                selectedNodes[source].push(...data.results);

                addResultToDisplay(data.results);
                highlightEdges(data.results);  // Highlight the edges in the visualization

                // Add edge ID to the set of added edges
                addedEdges.add(edgeId);

                // Show the "Generate Report" and "Export as Image" buttons
                document.getElementById('generate-report-button').style.display = 'block';
                document.getElementById('export-image-button').style.display = 'block';
            })
            .catch(error => console.error('Error:', error));
        }
    });
});

function addResultToDisplay(results) {
    const resultsTableBody = document.getElementById('results-table-body');
    const resultSection = document.getElementById('result');
    const resultTable = document.querySelector('#result table'); // Select the table itself

    results.forEach(result => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${result.edge}</td>
            <td>${result.score.toFixed(4)}</td>
            <td>${network.body.data.edges.get(result.edge).weight}</td>
            <td><input type="color" class="color-picker" data-edge="${result.edge}" value="#ff0000"></td>
            <td><button class="btn btn-danger btn-sm remove-btn" data-edge="${result.edge}">Remove</button></td>
        `;
        resultsTableBody.appendChild(row);

        // Add click event for color picker
        row.querySelector('.color-picker').addEventListener('input', function() {
            changeEdgeColor(result.edge, this.value);
        });

        // Add click event for remove button
        row.querySelector('.remove-btn').addEventListener('click', function() {
            removeEdgeHighlight(result.edge, row);
        });
    });

    resultTable.style.display = 'table'; // Ensure the table is visible
    resultSection.style.display = 'block'; // Ensure the section is visible
}

function highlightEdges(results) {
    const edgeUpdate = results.map(result => {
        return {
            id: result.edge,
            color: { color: 'red' },  // Highlight color
            width: 4,  // Increase the width of the edge
            label: `${result.score.toFixed(4)}`,  // Display only the betweenness score
            title: `Betweenness: ${result.score.toFixed(4)}`  // Tooltip with betweenness score
        };
    });

    network.body.data.edges.update(edgeUpdate);  // Update the edges in the network visualization
}

function removeEdgeHighlight(edgeId, row) {
    // Get the current edge data
    const edge = network.body.data.edges.get(edgeId);
    const resultsTableBody = document.getElementById('results-table-body');
    const resultSection = document.getElementById('result');
    const resultTable = document.querySelector('#result table'); // Select the table itself

    if (edge) {
        // Remove the edge entirely
        network.body.data.edges.remove(edgeId);

        // Re-add the edge without the label
        network.body.data.edges.add({
            id: edgeId,
            from: edge.from,
            to: edge.to,
            color: { color: '#848484' },  // Reset color
            width: 1,  // Reset width
            label: null,  // Ensure no label is present
            title: `Weight: ${edge.weight}` // Tooltip with weight
        });

        // Remove the edge from the set of added edges
        addedEdges.delete(edgeId);
    }

    // Remove the row from the table
    row.remove();

    // Hide the entire result section (including table) if no rows are left
    if (!resultsTableBody.hasChildNodes()) {
        resultTable.style.display = 'none';  // Hide the table
        resultSection.style.display = 'none'; // Hide the section
    }
}

function changeEdgeColor(edgeId, color) {
    network.body.data.edges.update({
        id: edgeId,
        color: { color: color }  // Update the edge color
    });
}

// Display edge details (including betweenness centrality)
function showEdgeDetails(edge) {
    const betweennessScore = edge.label; // Extract betweenness score from the label
    alert(`Edge ${edge.from}-${edge.to}\nBetweenness Score: ${betweennessScore}`);
}

// Display betweenness centrality for edges connected to a node
function showNodeBetweenness(nodeId, edges) {
    const connectedEdges = edges.get({
        filter: function (edge) {
            return edge.from === nodeId || edge.to === nodeId;
        }
    });

    let message = `Node ${nodeId} is connected by the following edges:\n`;
    connectedEdges.forEach(edge => {
        message += `Edge ${edge.from}-${edge.to}\nBetweenness Score: ${edge.label}\n\n`;
    });

    alert(message);
}

// Generate the PDF report
document.getElementById('generate-report-button').addEventListener('click', function() {
    // Create a new div element to contain the report content
    const reportContent = document.createElement('div');
    reportContent.style.padding = '20px';
    reportContent.style.fontFamily = 'Arial, sans-serif';

    // Add the report title with your name
    const reportTitle = document.createElement('h2');
    reportTitle.textContent = 'Current Flow Betweenness Report';
    reportTitle.style.textAlign = 'center';
    reportTitle.style.color = '#333';
    reportTitle.style.marginBottom = '20px';

    // Add your name to the title
    const authorName = document.createElement('h5');
    authorName.textContent = 'By Gokul Srinath Seetha Ram';
    authorName.style.textAlign = 'center';
    authorName.style.color = '#666';
    authorName.style.marginBottom = '30px';

    reportContent.appendChild(reportTitle);
    reportContent.appendChild(authorName);

    // Create a table to hold the report data
    const reportTable = document.createElement('table');
    reportTable.style.width = '100%';
    reportTable.style.borderCollapse = 'collapse';

    // Create the table header
    const headerRow = document.createElement('tr');
    headerRow.style.backgroundColor = '#f4f4f4';
    headerRow.style.borderBottom = '2px solid #ddd';
    headerRow.innerHTML = `
        <th style="padding: 10px; text-align: left;">Edge</th>
        <th style="padding: 10px; text-align: left;">Betweenness Score</th>
        <th style="padding: 10px; text-align: left;">Weight</th>
        <th style="padding: 10px; text-align: left;">Color</th>
    `;
    reportTable.appendChild(headerRow);

    // Populate the table with results
    Object.keys(selectedNodes).forEach(sourceNode => {
        selectedNodes[sourceNode].forEach(result => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${result.edge}</td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${result.score.toFixed(4)}</td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${network.body.data.edges.get(result.edge).weight}</td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">
                    <div style="width: 20px; height: 20px; background-color: ${network.body.data.edges.get(result.edge).color.color};"></div>
                </td>
            `;
            reportTable.appendChild(row);
        });
    });

    reportContent.appendChild(reportTable);

    // Append the report content to the body (hidden)
    document.body.appendChild(reportContent);

    // Convert the report content to PDF
    html2pdf()
        .from(reportContent)
        .set({
            margin: 1,
            filename: 'current_flow_betweenness_report.pdf',
            html2canvas: { scale: 2 },
            jsPDF: { orientation: 'portrait', unit: 'in', format: 'letter', compressPDF: true }
        })
        .save()
        .then(() => {
            // Clean up the DOM by removing the report content from the body
            document.body.removeChild(reportContent);
        })
        .catch(error => console.error('Error generating PDF:', error));
});

// Export network as an image
document.getElementById('export-image-button').addEventListener('click', function () {
    const canvas = network.canvas.frame.canvas;
    const dataUrl = canvas.toDataURL('image/png');

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = 'network_visualization.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// Customizable node and edge colors
function setColorScheme(nodeColor, edgeColor) {
    network.body.data.nodes.forEach(node => {
        network.body.data.nodes.update({
            id: node.id,
            color: nodeColor
        });
    });

    network.body.data.edges.forEach(edge => {
        network.body.data.edges.update({
            id: edge.id,
            color: { color: edgeColor }
        });
    });
}

// Dynamic edge thickness based on weight or betweenness score
function adjustEdgeThicknessBasedOnWeightOrBetweenness() {
    network.body.data.edges.forEach(edge => {
        const weight = edge.weight || 1; // Default to 1 if weight is undefined
        const betweennessScore = parseFloat(edge.label) || 0.1; // Default to 0.1 if betweenness score is undefined
        network.body.data.edges.update({
            id: edge.id,
            width: weight * 2, // Scale thickness based on weight
            label: edge.label,
            title: `Betweenness: ${betweennessScore.toFixed(4)}` // Tooltip with betweenness score
        });
    });
}

// Add the zoom and pan controls
document.addEventListener('DOMContentLoaded', function () {
    // Call the zoom and pan controls after the DOM has fully loaded
    addZoomAndPanControls();
});

function addZoomAndPanControls() {
    const zoomInButton = document.getElementById('zoom-in-button');
    const zoomOutButton = document.getElementById('zoom-out-button');

    zoomInButton.addEventListener('click', function () {
        const scale = network.getScale();
        network.moveTo({
            scale: scale * 1.2
        });
    });

    zoomOutButton.addEventListener('click', function () {
        const scale = network.getScale();
        network.moveTo({
            scale: scale / 1.2
        });
    });
}

// Update the visualization after applying a layout change
function updateVisualization() {
    network.stabilize();
    adjustEdgeThicknessBasedOnWeightOrBetweenness();
}
