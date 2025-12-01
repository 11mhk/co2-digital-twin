from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import json

# Import your simulation function
from run_simulation import run as run_simulation


app = FastAPI()

# CORS ENABLED FOR FRONTEND
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------
# DATA MODELS
# --------------------
class TileRequest(BaseModel):
    tile_id: int
    factors: dict


class CityRequest(BaseModel):
    city: str


# --------------------
# BASIC API ENDPOINTS
# --------------------
@app.get("/api/grid")
def get_grid():
    df = pd.read_csv("data/grid.csv")
    return df.to_dict(orient="records")


@app.get("/api/emissions")
def get_emissions():
    with open("data/emissions.json") as f:
        return json.load(f)


# --------------------
# CITY SWITCHING API
# --------------------
@app.post("/api/change_city")
def change_city(request: CityRequest):
    city_name = request.city

    try:
        run_simulation(city_name)

        return {
            "status": "success",
            "message": f"City updated to {city_name}",
            "city": city_name
        }

    except Exception as e:
        return {"error": str(e)}



# --------------------
# REAL CO2 MODEL (8 FACTORS)
# --------------------
FACTOR_WEIGHTS = {
    "green": -0.7,
    "water": -0.3,
    "buildings": 0.4,
    "vehicles": 0.6,
    "industrial": 0.8,
    "energy": 0.5,
    "congestion": 0.9,
    "public_transport": -0.5
}


def normalize(value, min_val=0, max_val=100):
    return (value - min_val) / (max_val - min_val)


@app.post("/api/tile/update")
def update_tile(payload: TileRequest):

    try:
        tile_index = payload.tile_id
        factors = payload.factors

        # Load baseline CO2 from grid
        df = pd.read_csv("data/grid.csv")
        base_co2 = df.iloc[tile_index]["co2"]

        # Normalize inputs
        green = normalize(factors.get("green", 50), 0, 100)
        water = normalize(factors.get("water", 50), 0, 100)
        buildings = normalize(factors.get("buildings", 50), 0, 100)
        vehicles = normalize(factors.get("vehicles", 2000), 0, 10000)
        industrial = normalize(factors.get("industrial", 50), 0, 100)
        energy = normalize(factors.get("energy", 1000), 0, 5000)
        congestion = normalize(factors.get("congestion", 0.5), 0, 1)
        public_transport = normalize(factors.get("public_transport", 0.5), 0, 1)

        # CO2 formula
        CO2_new = (
            base_co2
            + FACTOR_WEIGHTS["green"] * green
            + FACTOR_WEIGHTS["water"] * water
            + FACTOR_WEIGHTS["buildings"] * buildings
            + FACTOR_WEIGHTS["vehicles"] * vehicles
            + FACTOR_WEIGHTS["industrial"] * industrial
            + FACTOR_WEIGHTS["energy"] * energy
            + FACTOR_WEIGHTS["congestion"] * congestion
            + FACTOR_WEIGHTS["public_transport"] * public_transport
        )

        # Avoid negative
        CO2_new = max(CO2_new, 0)

        # Map CO2 to color
        if CO2_new > 8000:
            color = "#d73027"   # red
        elif CO2_new > 4000:
            color = "#fc8d59"   # orange
        else:
            color = "#fee08b"   # yellow

        return {
            "tile_id": tile_index,
            "co2_value": CO2_new,
            "color": color
        }

    except Exception as e:
        return {"error": str(e)}
