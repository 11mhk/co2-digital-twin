import geopandas as gpd
import pandas as pd
import json
import numpy as np
import logging
from shapely.geometry import box

logging.basicConfig(level=logging.INFO)

# Basic emission factor (grams CO₂ per km × traffic weight)
EMISSION_FACTOR = 150

def compute_emissions(gdf_edges: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """
    Computes CO2 emissions for each road segment.
    """

    logging.info("Computing emissions on road segments...")

    # Convert meters → kilometers
    gdf_edges["length_km"] = gdf_edges["length"] / 1000

    def traffic_weight(highway):
        if isinstance(highway, list):
            highway = highway[0]
        if highway in ["motorway", "primary"]:
            return 3
        if highway in ["secondary"]:
            return 2
        return 1

    gdf_edges["traffic"] = gdf_edges["highway"].apply(traffic_weight)

    # CO₂ formula
    gdf_edges["co2"] = gdf_edges["length_km"] * gdf_edges["traffic"] * EMISSION_FACTOR

    logging.info("Emissions computed successfully.")
    return gdf_edges


def export_emission_points(gdf_edges: gpd.GeoDataFrame, output_path="data/emissions.json"):
    """
    Exports centroid CO2 emission points for heatmap visualization.
    """

    logging.info("Exporting emission points for heatmap...")

    points = []

    for _, row in gdf_edges.iterrows():
        centroid = row.geometry.centroid
        points.append({
            "lat": float(centroid.y),
            "lon": float(centroid.x),
            "co2": float(row["co2"])
        })

    with open(output_path, "w") as f:
        json.dump(points, f, indent=2)

    logging.info(f"Emission points exported to {output_path}")


def generate_grid(gdf_edges: gpd.GeoDataFrame, grid_size=10, output_path="data/grid.csv"):
    """
    Creates a city-wide grid and calculates CO2 intensity inside each grid cell.
    """

    logging.info("Generating grid heatmap data...")

    minx, miny, maxx, maxy = gdf_edges.total_bounds
    dx = (maxx - minx) / grid_size
    dy = (maxy - miny) / grid_size

    rows = []

    for i in range(grid_size):
        for j in range(grid_size):
            cell = box(
                minx + i*dx,
                miny + j*dy,
                minx + (i+1)*dx,
                miny + (j+1)*dy
            )

            mask = gdf_edges.centroid.within(cell)
            total_co2 = gdf_edges.loc[mask, "co2"].sum()

            rows.append({
                "row": i,
                "col": j,
                "co2": float(total_co2)
            })

    df = pd.DataFrame(rows)
    df.to_csv(output_path, index=False)

    logging.info(f"Grid saved to {output_path}")
