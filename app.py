from flask import Flask, render_template, request, jsonify, make_response
import pandas as pd
import networkx as nx
import json
from fpdf import FPDF

app = Flask(__name__)

# Global graph object to store the graph across requests
G = None

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    global G  # Use the global graph variable
    file = request.files['file']
    if not file:
        return jsonify({"error": "No file uploaded"}), 400

    try:
        # Load the CSV data into a pandas DataFrame
        df = pd.read_csv(file)

        if df.empty:
            return jsonify({"error": "The uploaded CSV file is empty or improperly formatted."}), 400

        required_columns = ['source', 'target', 'weight']
        if not all(column in df.columns for column in required_columns):
            return jsonify({"error": "CSV file must have 'source', 'target', and 'weight' columns."}), 400

        # Create the graph from the CSV data
        G = nx.Graph()
        for _, row in df.iterrows():
            G.add_edge(int(row['source']), int(row['target']), weight=float(row['weight']))

        # Extract nodes and edges for dropdowns
        nodes = [int(node) for node in G.nodes()]
        edges = [{'source': int(u), 'target': int(v), 'weight': G[u][v]['weight']} for u, v in G.edges()]

        return jsonify({
            'nodes': nodes,
            'edges': edges
        })
    except Exception as e:
        print("Error during file upload:", e)
        return jsonify({"error": str(e)}), 500

@app.route('/calculate', methods=['GET'])
def calculate_betweenness():
    global G  # Use the global graph variable
    source = request.args.get('source', type=int)
    sinks = request.args.getlist('sink', type=int)  # Allows for multiple sinks

    if source is None or not sinks:
        return jsonify({"error": "Source and at least one sink node must be provided"}), 400

    try:
        # Calculate betweenness centrality for all edges
        betweenness = nx.edge_current_flow_betweenness_centrality(G, normalized=True, weight='weight')

        # Filter the results to only include edges between the selected source and sink nodes
        results = []
        for (u, v), score in betweenness.items():
            if (u == source or v == source) and (u in sinks or v in sinks):
                results.append({'edge': f'{u}-{v}', 'score': score})

        print("Calculation successful. Results prepared.")

        return jsonify({
            'results': results
        })
    except Exception as e:
        print("Error occurred during betweenness calculation:", e)
        return jsonify({"error": str(e)}), 500

@app.route('/save', methods=['POST'])
def save_configuration():
    global G  # Use the global graph variable
    try:
        data = request.json
        with open('saved_configuration.json', 'w') as f:
            json.dump(data, f)
        return jsonify({"message": "Configuration saved successfully!"})
    except Exception as e:
        print("Error saving configuration:", e)
        return jsonify({"error": str(e)}), 500

@app.route('/load', methods=['GET'])
def load_configuration():
    try:
        with open('saved_configuration.json', 'r') as f:
            data = json.load(f)
        return jsonify(data)
    except Exception as e:
        print("Error loading configuration:", e)
        return jsonify({"error": str(e)}), 500

@app.route('/report', methods=['POST'])
def generate_report():
    global G  # Use the global graph variable
    data = request.json
    selected_nodes = data.get('selectedNodes', {})

    try:
        pdf = FPDF()
        pdf.add_page()
        pdf.set_font("Arial", size=12)

        pdf.cell(200, 10, txt="Network Report", ln=True, align="C")

        pdf.cell(200, 10, txt="Selected Nodes and Betweenness Scores", ln=True, align="L")

        for source, results in selected_nodes.items():
            pdf.cell(200, 10, txt=f"Source Node: {source}", ln=True, align="L")
            for result in results:
                pdf.cell(200, 10, txt=f"Edge: {result['edge']}, Betweenness: {result['score']:.4f}", ln=True, align="L")

        # Add other metrics
        highest_betweenness = max(nx.edge_current_flow_betweenness_centrality(G, normalized=True, weight='weight').values())
        most_connected_node = max(dict(G.degree()).items(), key=lambda x: x[1])[0]

        pdf.cell(200, 10, txt=f"Highest Betweenness Score: {highest_betweenness:.4f}", ln=True, align="L")
        pdf.cell(200, 10, txt=f"Most Connected Node: {most_connected_node}", ln=True, align="L")

        response = make_response(pdf.output(dest='S').encode('latin1'))
        response.headers.set('Content-Disposition', 'attachment', filename='network_report.pdf')
        response.headers.set('Content-Type', 'application/pdf')

        return response
    except Exception as e:
        print("Error generating report:", e)
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
