import logging
import osmnx as ox
import geopandas as gpd
from utils.load_map import load_city_graph
from utils.emission_model import compute_emissions, export_emission_points, generate_grid

logging.basicConfig(level=logging.INFO)

def run(city="Pune, India"):
    logging.info("Starting CO2 simulation pipeline...")

    G = load_city_graph(city)
    gdf_edges = ox.graph_to_gdfs(G, nodes=False)

    gdf_edges = compute_emissions(gdf_edges)

    export_emission_points(gdf_edges, "data/emissions.json")

    generate_grid(gdf_edges, grid_size=10, output_path="data/grid.csv")

    logging.info("Simulation completed successfully!")

if __name__ == "__main__":
    run()
