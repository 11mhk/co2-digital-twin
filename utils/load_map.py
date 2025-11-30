import osmnx as ox
import logging

logging.basicConfig(level=logging.INFO)

def load_city_graph(city_name: str):
    """
    Loads the road network of a city using OSMnx.
    """
    logging.info(f"Loading OSM data for {city_name} ...")
    G = ox.graph_from_place(city_name, network_type="drive")
    logging.info(f"OSM data loaded successfully.")
    return G
