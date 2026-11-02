// Generated from course-design.json by scripts/create_project.py.
export const COURSE_DESIGN = {
  "version": 1,
  "course": {
    "name": "WINGLAB Aurora Operasyonu",
    "length": 8000,
    "corridorHalfWidth": 150,
    "mountainStart": 500,
    "mountainEnd": 8500
  },
  "gates": [
    600,
    1600,
    2800,
    4000,
    5200,
    6000,
    6900,
    7700,
    8000
  ],
  "turns": [
    {
      "id": 1,
      "start": 5200,
      "end": 5700,
      "direction": "left",
      "angle": 10
    },
    {
      "id": 2,
      "start": 6200,
      "end": 6700,
      "direction": "right",
      "angle": 15
    },
    {
      "id": 3,
      "start": 7000,
      "end": 7500,
      "direction": "left",
      "angle": 20
    }
  ],
  "caves": [
    {
      "id": 1,
      "start": 1400,
      "end": 2050,
      "halfWidth": 120,
      "floorY": 0,
      "ceilingY": 150
    },
    {
      "id": 2,
      "start": 3500,
      "end": 4250,
      "halfWidth": 120,
      "floorY": 0,
      "ceilingY": 160
    },
    {
      "id": 3,
      "start": 6000,
      "end": 6800,
      "halfWidth": 120,
      "floorY": 0,
      "ceilingY": 165
    }
  ],
  "boosts": [
    {
      "id": 1,
      "start": 850,
      "end": 1120,
      "y": 57.15,
      "halfWidth": 80,
      "halfHeight": 38,
      "multiplier": 1.45
    },
    {
      "id": 2,
      "start": 2550,
      "end": 2850,
      "y": 57.15,
      "halfWidth": 80,
      "halfHeight": 38,
      "multiplier": 1.45
    },
    {
      "id": 3,
      "start": 4900,
      "end": 5220,
      "y": 57.15,
      "halfWidth": 80,
      "halfHeight": 38,
      "multiplier": 1.45
    },
    {
      "id": 4,
      "start": 7150,
      "end": 7420,
      "y": 57.15,
      "halfWidth": 80,
      "halfHeight": 38,
      "multiplier": 1.45
    }
  ],
  "diamonds": {
    "start": 120,
    "spacing": 115
  }
};
