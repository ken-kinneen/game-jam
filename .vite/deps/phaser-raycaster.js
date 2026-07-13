import {
  require_phaser
} from "./chunk-FVQTIQGM.js";
import {
  __esm,
  __export,
  __toCommonJS,
  __toESM
} from "./chunk-V4OQ3NZ2.js";

// node_modules/phaser-raycaster/src/map/map-rectangle-methods.js
var map_rectangle_methods_exports = {};
__export(map_rectangle_methods_exports, {
  getPoints: () => getPoints,
  getSegments: () => getSegments,
  updateMap: () => updateMap
});
function getPoints(ray = false) {
  if (!this.active)
    return [];
  return this._points;
}
function getSegments() {
  if (!this.active)
    return [];
  return this._segments;
}
function updateMap() {
  if (!this.active)
    return this;
  let points = [];
  let segments = [];
  points = [
    this.object.getTopLeft(),
    this.object.getTopRight(),
    this.object.getBottomRight(),
    this.object.getBottomLeft()
  ];
  for (let i = 0, length = points.length; i < length; i++) {
    let prevPoint = i > 0 ? points[i - 1] : points.slice(-1)[0], nextPoint = i < length - 1 ? points[i + 1] : points[0];
    segments.push(new import_phaser.Geom.Line(points[i].x, points[i].y, nextPoint.x, nextPoint.y));
    points[i].neighbours = [
      prevPoint,
      nextPoint
    ];
  }
  this._points = points;
  this._segments = segments;
  return this;
}
var import_phaser;
var init_map_rectangle_methods = __esm({
  "node_modules/phaser-raycaster/src/map/map-rectangle-methods.js"() {
    import_phaser = __toESM(require_phaser());
  }
});

// node_modules/phaser-raycaster/src/map/map-line-methods.js
var map_line_methods_exports = {};
__export(map_line_methods_exports, {
  getPoints: () => getPoints2,
  getSegments: () => getSegments2,
  updateMap: () => updateMap2
});
function getPoints2(ray = false) {
  if (!this.active)
    return [];
  return this._points;
}
function getSegments2() {
  if (!this.active)
    return [];
  return this._segments;
}
function updateMap2() {
  if (!this.active)
    return this;
  let points = [];
  let segments = [];
  let offset = new import_phaser2.Math.Vector2();
  offset.x = this.object.x - this.object.displayWidth * this.object.originX;
  offset.y = this.object.y - this.object.displayHeight * this.object.originY;
  let pointA = this.object.geom.getPointA();
  let pointB = this.object.geom.getPointB();
  let rotation = this.object.rotation;
  if (rotation !== 0) {
    let vectorA = new import_phaser2.Geom.Line(this.object.x, this.object.y, pointA.x * this.object.scaleX + offset.x, pointA.y * this.object.scaleY + offset.y);
    import_phaser2.Geom.Line.SetToAngle(vectorA, this.object.x, this.object.y, import_phaser2.Geom.Line.Angle(vectorA) + rotation, import_phaser2.Geom.Line.Length(vectorA));
    pointA = vectorA.getPointB();
    let vectorB = new import_phaser2.Geom.Line(this.object.x, this.object.y, pointB.x * this.object.scaleX + offset.x, pointB.y * this.object.scaleY + offset.y);
    import_phaser2.Geom.Line.SetToAngle(vectorB, this.object.x, this.object.y, import_phaser2.Geom.Line.Angle(vectorB) + rotation, import_phaser2.Geom.Line.Length(vectorB));
    pointB = vectorB.getPointB();
    points.push(new import_phaser2.Math.Vector2(pointA.x, pointA.y));
    points.push(new import_phaser2.Math.Vector2(pointB.x, pointB.y));
    segments.push(new import_phaser2.Geom.Line(pointA.x, pointA.y, pointB.x, pointB.y));
  } else {
    points.push(new import_phaser2.Math.Vector2(pointA.x * this.object.scaleX + offset.x, pointA.y * this.object.scaleY + offset.y));
    points.push(new import_phaser2.Math.Vector2(pointB.x * this.object.scaleX + offset.x, pointB.y * this.object.scaleY + offset.y));
    segments.push(new import_phaser2.Geom.Line(pointA.x * this.object.scaleX + offset.x, pointA.y * this.object.scaleY + offset.y, pointB.x + offset.x * this.object.scaleX, pointB.y * this.object.scaleY + offset.y));
  }
  points[0].neighbours = [points[1]];
  points[1].neighbours = [points[0]];
  this._points = points;
  this._segments = segments;
  return this;
}
var import_phaser2;
var init_map_line_methods = __esm({
  "node_modules/phaser-raycaster/src/map/map-line-methods.js"() {
    import_phaser2 = __toESM(require_phaser());
  }
});

// node_modules/phaser-raycaster/src/map/map-polygon-methods.js
var map_polygon_methods_exports = {};
__export(map_polygon_methods_exports, {
  getPoints: () => getPoints3,
  getSegments: () => getSegments3,
  updateMap: () => updateMap3
});
function getPoints3(ray = false) {
  if (!this.active)
    return [];
  return this._points;
}
function getSegments3() {
  if (!this.active)
    return [];
  return this._segments;
}
function updateMap3() {
  if (!this.active)
    return this;
  let points = [];
  let segments = [];
  let offset = new import_phaser3.Math.Vector2();
  offset.x = this.object.x - this.object.displayWidth * this.object.originX;
  offset.y = this.object.y - this.object.displayHeight * this.object.originY;
  let rotation = this.object.rotation;
  if (rotation !== 0) {
    for (let point of this.object.geom.points) {
      let vector = new import_phaser3.Geom.Line(this.object.x, this.object.y, point.x * this.object.scaleX + offset.x, point.y * this.object.scaleY + offset.y);
      import_phaser3.Geom.Line.SetToAngle(vector, this.object.x, this.object.y, import_phaser3.Geom.Line.Angle(vector) + rotation, import_phaser3.Geom.Line.Length(vector));
      points.push(vector.getPointB());
    }
  } else {
    for (let point of this.object.geom.points) {
      points.push(new import_phaser3.Math.Vector2(point.x * this.object.scaleX + offset.x, point.y * this.object.scaleY + offset.y));
    }
  }
  for (let i = 0, length = points.length; i < length; i++) {
    let prevPoint = i > 0 ? points[i - 1] : points.slice(-1)[0], nextPoint = i < length - 1 ? points[i + 1] : points[0];
    segments.push(new import_phaser3.Geom.Line(points[i].x, points[i].y, nextPoint.x, nextPoint.y));
    points[i].neighbours = [
      prevPoint,
      nextPoint
    ];
  }
  for (let i = 0, length = points.length; i < length; i++) {
    if (i + 1 < length)
      segments.push(new import_phaser3.Geom.Line(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y));
  }
  if (!this.object.closePath) {
    segments.pop();
    points[0].neighbours.shift();
    points[points.length - 1].neighbours.pop();
  }
  this._points = points;
  this._segments = segments;
  return this;
}
var import_phaser3;
var init_map_polygon_methods = __esm({
  "node_modules/phaser-raycaster/src/map/map-polygon-methods.js"() {
    import_phaser3 = __toESM(require_phaser());
  }
});

// node_modules/phaser-raycaster/src/map/map-circle-methods.js
var map_circle_methods_exports = {};
__export(map_circle_methods_exports, {
  getPoints: () => getPoints4,
  getSegments: () => getSegments4,
  updateMap: () => updateMap4
});
function getPoints4(ray = false) {
  if (!this.active)
    return [];
  if (this._points.length > 0)
    return this._points;
  let points = [];
  let offset = new import_phaser4.Math.Vector2();
  offset.x = this.object.x - this.object.displayWidth * (this.object.originX - 0.5);
  offset.y = this.object.y - this.object.displayHeight * (this.object.originY - 0.5);
  if (ray) {
    let rayA = new import_phaser4.Geom.Line();
    let rayB = new import_phaser4.Geom.Line();
    let c;
    let rotation = this.object.rotation;
    if (rotation !== 0) {
      let vector = new import_phaser4.Geom.Line(this.object.x, this.object.y, offset.x, offset.y);
      import_phaser4.Geom.Line.SetToAngle(vector, this.object.x, this.object.y, import_phaser4.Geom.Line.Angle(vector) + rotation, import_phaser4.Geom.Line.Length(vector));
      let cB = vector.getPointB();
      c = new import_phaser4.Geom.Line(ray.origin.x, ray.origin.y, cB.x, cB.y);
    } else {
      c = new import_phaser4.Geom.Line(ray.origin.x, ray.origin.y, offset.x, offset.y);
    }
    let rayLength = Math.sqrt(Math.pow(import_phaser4.Geom.Line.Length(c), 2) - Math.pow(this.object.radius * this.object.scaleX, 2));
    let angle = import_phaser4.Geom.Line.Angle(c);
    let dAngle = Math.asin(this.object.radius * this.object.scaleX / import_phaser4.Geom.Line.Length(c));
    import_phaser4.Geom.Line.SetToAngle(rayA, ray.origin.x, ray.origin.y, angle - dAngle, rayLength);
    import_phaser4.Geom.Line.SetToAngle(rayB, ray.origin.x, ray.origin.y, angle + dAngle, rayLength);
    points.push(rayA.getPointB());
    points.push(rayB.getPointB());
    points[0].neighbours = [points[1]];
    points[1].neighbours = [points[0]];
  }
  return points;
}
function getSegments4() {
  if (!this.active)
    return [];
  return this._segments;
}
function updateMap4() {
  if (!this.active)
    return this;
  if (!this.segmentCount) {
    this._points = [];
    this._segments = [];
    return this;
  }
  let offset = new import_phaser4.Math.Vector2();
  offset.x = this.object.x - this.object.displayWidth * this.object.originX + this.object.radius * this.object.scaleX;
  offset.y = this.object.y - this.object.displayHeight * this.object.originY + this.object.radius * this.object.scaleY;
  let points = this.object.geom.getPoints(this.segmentCount);
  let segments = [];
  let rotation = this.object.rotation;
  if (rotation !== 0) {
    let newPoints = [];
    for (let point of points) {
      let vector = new import_phaser4.Geom.Line(this.object.x, this.object.y, this.object.x + (point.x + this.object.radius) * this.object.scaleX, this.object.y + (point.y + this.object.radius) * this.object.scaleY);
      import_phaser4.Geom.Line.SetToAngle(vector, this.object.x, this.object.y, import_phaser4.Geom.Line.Angle(vector) + rotation, import_phaser4.Geom.Line.Length(vector));
      newPoints.push(vector.getPointB());
    }
    points = newPoints;
  } else {
    for (let point of points) {
      point.x = point.x * this.object.scaleX + offset.x;
      point.y = point.y * this.object.scaleY + offset.y;
    }
  }
  for (let i = 0, length = points.length; i < length; i++) {
    let prevPoint = i > 0 ? points[i - 1] : points.slice(-1)[0], nextPoint = i < length - 1 ? points[i + 1] : points[0];
    segments.push(new import_phaser4.Geom.Line(points[i].x, points[i].y, nextPoint.x, nextPoint.y));
    points[i].neighbours = [
      prevPoint,
      nextPoint
    ];
  }
  this._points = points;
  this._segments = segments;
  return this;
}
var import_phaser4;
var init_map_circle_methods = __esm({
  "node_modules/phaser-raycaster/src/map/map-circle-methods.js"() {
    import_phaser4 = __toESM(require_phaser());
  }
});

// node_modules/phaser-raycaster/src/map/map-container-methods.js
var map_container_methods_exports = {};
__export(map_container_methods_exports, {
  _updateChildMap: () => _updateChildMap,
  getPoints: () => getPoints5,
  getSegments: () => getSegments5,
  updateMap: () => updateMap5
});
function getPoints5(ray = false, isChild = false) {
  if (!this.active)
    return [];
  let points = this._points;
  let offset = new import_phaser5.Math.Vector2();
  offset.x = this.object.x - this.object.displayWidth * this.object.originX;
  offset.y = this.object.y - this.object.displayHeight * this.object.originY;
  if (this.segmentCount == 0 && !isChild) {
    if (ray) {
      let vector = new import_phaser5.Geom.Line(0, 0, ray.origin.x - offset.x, ray.origin.y - offset.y);
      import_phaser5.Geom.Line.SetToAngle(vector, 0, 0, import_phaser5.Geom.Line.Angle(vector) - this.object.rotation, import_phaser5.Geom.Line.Length(vector));
      let rayA = new import_phaser5.Geom.Line(), rayB = new import_phaser5.Geom.Line(), c;
      for (let circle of this._circles) {
        circle.points = [];
        c = new import_phaser5.Geom.Line(ray.origin.x, ray.origin.y, circle.x, circle.y);
        let rayLength = Math.sqrt(Math.pow(import_phaser5.Geom.Line.Length(c), 2) - Math.pow(circle.radius, 2));
        let angle = import_phaser5.Geom.Line.Angle(c);
        let dAngle = Math.asin(circle.radius / import_phaser5.Geom.Line.Length(c));
        import_phaser5.Geom.Line.SetToAngle(rayA, ray.origin.x, ray.origin.y, angle - dAngle, rayLength);
        import_phaser5.Geom.Line.SetToAngle(rayB, ray.origin.x, ray.origin.y, angle + dAngle, rayLength);
        circle.points.push(rayA.getPointB());
        circle.points.push(rayB.getPointB());
        points.push(rayA.getPointB());
        points.push(rayB.getPointB());
      }
    }
  }
  return points;
}
function getSegments5() {
  if (!this.active)
    return [];
  return this._segments;
}
function updateMap5() {
  if (!this.active)
    return this;
  let points = [];
  let segments = [];
  let container2 = this.object;
  this._circles = [];
  let offset = new import_phaser5.Math.Vector2();
  offset.x = this.object.x - this.object.displayWidth * this.object.originX;
  offset.y = this.object.y - this.object.displayHeight * this.object.originY;
  let rotation = container2.rotation;
  if (this.mapChild) {
    this._updateChildMap(this.mapChild, points, segments, rotation, offset);
  } else {
    container2.iterate((function(child) {
      this._updateChildMap(child, points, segments, rotation, offset);
    }).bind(this));
    for (let i = 0, iLength = container2.list.length; i < iLength; i++) {
      let childA = container2.list[i];
      let mapA = childA.data.get("raycasterMap");
      if (!mapA)
        continue;
      for (let j = i + 1, jLength = container2.list.length; j < jLength; j++) {
        let childB = container2.list[j];
        let mapB = childB.data.get("raycasterMap");
        if (!mapB || !import_phaser5.Geom.Intersects.RectangleToRectangle(childA.getBounds(), childB.getBounds()))
          continue;
        for (let segmentA of mapA.getSegments()) {
          for (let segmentB of mapB.getSegments()) {
            let intersection = [];
            if (!import_phaser5.Geom.Intersects.LineToLine(segmentA, segmentB, intersection))
              continue;
            if (rotation !== 0) {
              let vector = new import_phaser5.Geom.Line(container2.x, container2.y, intersection.x * container2.scaleX + offset.x, intersection.y * container2.scaleY + offset.y);
              import_phaser5.Geom.Line.SetToAngle(vector, this.object.x, this.object.y, import_phaser5.Geom.Line.Angle(vector) + rotation, import_phaser5.Geom.Line.Length(vector));
              points.push(vector.getPointB());
            } else
              points.push(new import_phaser5.Math.Vector2(intersection.x * container2.scaleX + offset.x, intersection.y * container2.scaleX + offset.y));
          }
        }
      }
    }
  }
  this._points = points;
  this._segments = segments;
  return this;
}
function _updateChildMap(child, points, segments, rotation, offset) {
  if (!child.data)
    child.setDataEnabled();
  if (child.data.get("raycasterMapNotSupported"))
    return;
  let map = child.data.get("raycasterMap");
  if (!map) {
    map = new this.constructor({
      object: child,
      segmentCount: this.segmentCount
    });
    if (map.notSupported) {
      map.destroy();
      child.data.set("raycasterMapNotSupported", true);
      return;
    }
    child.data.set("raycasterMap", map);
  } else
    map.updateMap();
  let childPoints = [];
  for (let point of map.getPoints(false, true)) {
    let childPoint;
    if (rotation !== 0) {
      let vector = new import_phaser5.Geom.Line(this.object.x, this.object.y, point.x * this.object.scaleX + offset.x, point.y * this.object.scaleY + offset.y);
      import_phaser5.Geom.Line.SetToAngle(vector, this.object.x, this.object.y, import_phaser5.Geom.Line.Angle(vector) + rotation, import_phaser5.Geom.Line.Length(vector));
      childPoint = vector.getPointB();
    } else
      childPoint = new import_phaser5.Math.Vector2(point.x * this.object.scaleX + offset.x, point.y * this.object.scaleX + offset.y);
    childPoint.neighbours = [];
    if (childPoints.length > 0) {
      let previousPoint = childPoints.slice(-1)[0];
      previousPoint.neighbours.push(childPoint);
      childPoint.neighbours.push(previousPoint);
    }
    childPoints.push(childPoint);
    points.push(childPoint);
  }
  if (childPoints.length > 0) {
    childPoints.slice(-1)[0].neighbours.push(childPoints[0]);
  }
  for (let segment of map.getSegments()) {
    if (rotation !== 0) {
      let pointA = segment.getPointA();
      let pointB = segment.getPointB();
      let vectorA = new import_phaser5.Geom.Line(this.object.x, this.object.y, pointA.x * this.object.scaleX + offset.x, pointA.y * this.object.scaleY + offset.y);
      let vectorB = new import_phaser5.Geom.Line(this.object.x, this.object.y, pointB.x * this.object.scaleX + offset.x, pointB.y * this.object.scaleY + offset.y);
      import_phaser5.Geom.Line.SetToAngle(vectorA, this.object.x, this.object.y, import_phaser5.Geom.Line.Angle(vectorA) + rotation, import_phaser5.Geom.Line.Length(vectorA));
      import_phaser5.Geom.Line.SetToAngle(vectorB, this.object.x, this.object.y, import_phaser5.Geom.Line.Angle(vectorB) + rotation, import_phaser5.Geom.Line.Length(vectorB));
      segments.push(new import_phaser5.Geom.Line(vectorA.getPointB().x, vectorA.getPointB().y, vectorB.getPointB().x, vectorB.getPointB().y));
    } else
      segments.push(new import_phaser5.Geom.Line(segment.getPointA().x * this.object.scaleX + offset.x, segment.getPointA().y * this.object.scaleY + offset.y, segment.getPointB().x * this.object.scaleX + offset.x, segment.getPointB().y * this.object.scaleY + offset.y));
  }
  if (map.type == "Arc" && this.segmentCount == 0) {
    let circleOffset = new Math.Vector2();
    circleOffset.x = (map.object.x - map.object.displayWidth * (map.object.originX - 0.5)) * this.object.scaleX + offset.x;
    circleOffset.y = (map.object.y - map.object.displayHeight * (map.object.originY - 0.5)) * this.object.scaleY + offset.y;
    if (rotation !== 0) {
      let vector = new import_phaser5.Geom.Line(this.object.x, this.object.y, circleOffset.x, circleOffset.y);
      import_phaser5.Geom.Line.SetToAngle(vector, this.object.x, this.object.y, import_phaser5.Geom.Line.Angle(vector) + rotation, import_phaser5.Geom.Line.Length(vector));
      circleOffset = vector.getPointB();
    }
    this._circles.push(new import_phaser5.Geom.Circle(circleOffset.x, circleOffset.y, map.object.radius * map.object.scaleX * this.object.scaleX));
  } else if (map.type === "Container") {
    for (let childMapCircle of map._circles) {
      let circleOffset = new import_phaser5.Math.Vector2();
      circleOffset.x = childMapCircle.x * this.object.scaleX + offset.x;
      circleOffset.y = childMapCircle.y * this.object.scaleY + offset.y;
      if (rotation !== 0) {
        let vector = new import_phaser5.Geom.Line(this.object.x, this.object.y, circleOffset.x, circleOffset.y);
        import_phaser5.Geom.Line.SetToAngle(vector, this.object.x, this.object.y, import_phaser5.Geom.Line.Angle(vector) + rotation, import_phaser5.Geom.Line.Length(vector));
        circleOffset = vector.getPointB();
      }
      this._circles.push(new import_phaser5.Geom.Circle(circleOffset.x, circleOffset.y, childMapCircle.radius * this.object.scaleX));
    }
  }
}
var import_phaser5;
var init_map_container_methods = __esm({
  "node_modules/phaser-raycaster/src/map/map-container-methods.js"() {
    import_phaser5 = __toESM(require_phaser());
  }
});

// node_modules/phaser-raycaster/src/map/map-tilemap-methods.js
var map_tilemap_methods_exports = {};
__export(map_tilemap_methods_exports, {
  getPoints: () => getPoints6,
  getSegments: () => getSegments6,
  setCollisionTiles: () => setCollisionTiles,
  updateMap: () => updateMap6
});
function getPoints6(ray = false) {
  if (!this.active)
    return [];
  if (!ray || ray && (ray.detectionRange == 0 || ray.detectionRange >= import_phaser6.Math.MAX_SAFE_INTEGER))
    return this._points;
  let points = [];
  for (let point of this._points) {
    if (import_phaser6.Math.Distance.Between(ray.origin.x, ray.origin.y, point.x, point.y) <= ray.detectionRange)
      points.push(point);
  }
  let segments = this.getSegments(ray);
  for (let segment of segments) {
    if (import_phaser6.Math.Distance.Between(ray.origin.x, ray.origin.y, segment.x1, segment.y1) > ray.detectionRange)
      points.push(new import_phaser6.Math.Vector2(segment.x1, segment.y1));
    if (import_phaser6.Math.Distance.Between(ray.origin.x, ray.origin.y, segment.x2, segment.y2) > ray.detectionRange)
      points.push(new import_phaser6.Math.Vector2(segment.x2, segment.y2));
  }
  return points;
}
function getSegments6(ray = false) {
  if (!this.active)
    return [];
  if (!ray || ray && (ray.detectionRange == 0 || ray.detectionRange >= import_phaser6.Math.MAX_SAFE_INTEGER))
    return this._segments;
  let segments = [];
  for (let segment of this._segments) {
    if (import_phaser6.Geom.Intersects.LineToCircle(segment, ray.detectionRangeCircle)) {
      segments.push(segment);
    }
  }
  return segments;
}
function updateMap6() {
  if (!this.active)
    return this;
  let points = [], segments = [], columns = Array(this.object.layer.data[0].length + 1);
  for (let i = 0, iLength = columns.length; i < iLength; i++) {
    columns[i] = [];
  }
  let offset = new import_phaser6.Math.Vector2(this.object.x, this.object.y);
  let row = this.object.layer.data[0], tileWidth = this.object.layer.tileWidth * this.object.scaleX, tileHeight = this.object.layer.tileHeight * this.object.scaleY, startPoint, endPoint;
  if (this.collisionTiles.includes(row[0].index)) {
    startPoint = new import_phaser6.Math.Vector2(offset.x, offset.y);
    endPoint = new import_phaser6.Math.Vector2(tileWidth + offset.x, offset.y);
    columns[0].push(startPoint);
  }
  for (let i = 1, iLength = row.length; i < iLength; i++) {
    let tile = row[i];
    if (!this.collisionTiles.includes(tile.index)) {
      if (startPoint) {
        startPoint.neighbours = [endPoint];
        endPoint.neighbours = [startPoint];
        points.push(startPoint, endPoint);
        segments.push(new import_phaser6.Geom.Line(startPoint.x, startPoint.y, endPoint.x, endPoint.y));
        columns[i].push(endPoint);
        startPoint = false;
        endPoint = false;
      }
      continue;
    }
    let x = i * tileWidth + offset.x, y2 = offset.y;
    if (!startPoint) {
      startPoint = new import_phaser6.Math.Vector2(x, y2);
      columns[i].push(startPoint);
    }
    if (!endPoint) {
      endPoint = new import_phaser6.Math.Vector2(x + tileWidth, y2);
    } else {
      endPoint.x = x + tileWidth;
    }
  }
  if (startPoint) {
    startPoint.neighbours = [endPoint];
    endPoint.neighbours = [startPoint];
    points.push(startPoint, endPoint);
    segments.push(new import_phaser6.Geom.Line(startPoint.x, startPoint.y, endPoint.x, endPoint.y));
    columns[row.length].push(endPoint);
  }
  startPoint = false;
  endPoint = false;
  let lastPoint = false;
  for (let i = 1, iLength = this.object.layer.data.length; i < iLength; i++) {
    row = this.object.layer.data[i];
    let higherRow = this.object.layer.data[i - 1];
    if (this.collisionTiles.includes(row[0].index) != this.collisionTiles.includes(higherRow[0].index)) {
      startPoint = new import_phaser6.Math.Vector2(offset.x, i * tileHeight + offset.y);
      endPoint = new import_phaser6.Math.Vector2(tileWidth + offset.x, i * tileHeight + offset.y);
      columns[0].push(startPoint);
    }
    for (let j = 1, jLength = row.length; j < jLength; j++) {
      let tile = row[j], isCollisionTile = this.collisionTiles.includes(tile.index), isCollisionHigherTile = this.collisionTiles.includes(higherRow[j].index);
      if (isCollisionTile == isCollisionHigherTile) {
        if (startPoint) {
          if (!startPoint.neighbours) {
            startPoint.neighbours = [endPoint];
            points.push(startPoint);
          }
          endPoint.neighbours = [lastPoint ? lastPoint : startPoint];
          points.push(endPoint);
          segments.push(new import_phaser6.Geom.Line(startPoint.x, startPoint.y, endPoint.x, endPoint.y));
          columns[j].push(endPoint);
          startPoint = false;
          endPoint = false;
        }
        continue;
      }
      let x = j * tileWidth + offset.x, y2 = i * tileHeight + offset.y;
      if (startPoint && this.collisionTiles.includes(higherRow[j - 1].index) != isCollisionHigherTile) {
        let midPoint = new import_phaser6.Math.Vector2(x, y2);
        midPoint.neighbours = [lastPoint ? lastPoint : startPoint];
        lastPoint = midPoint;
        if (!startPoint.neighbours)
          startPoint.neighbours = [lastPoint];
        points.push(midPoint);
      }
      if (!startPoint) {
        startPoint = new import_phaser6.Math.Vector2(x, y2);
        columns[j].push(startPoint);
        lastPoint = false;
      }
      if (!endPoint) {
        endPoint = new import_phaser6.Math.Vector2(x + tileWidth, y2);
      } else {
        endPoint.x = x + tileWidth;
      }
    }
    if (startPoint) {
      if (!startPoint.neighbours)
        startPoint.neighbours = [lastPoint ? lastPoint : endPoint];
      endPoint.neighbours = [lastPoint ? lastPoint : startPoint];
      if (lastPoint)
        lastPoint.neighbours.push(endPoint);
      points.push(startPoint, endPoint);
      segments.push(new import_phaser6.Geom.Line(startPoint.x, startPoint.y, endPoint.x, endPoint.y));
      columns[row.length].push(endPoint);
    }
    startPoint = false;
    endPoint = false;
    lastPoint = false;
  }
  row = this.object.layer.data.slice(-1)[0];
  let y = this.object.layer.data.length * tileHeight + offset.y;
  if (this.collisionTiles.includes(row[0].index)) {
    startPoint = new import_phaser6.Math.Vector2(offset.x, y);
    endPoint = new import_phaser6.Math.Vector2(tileWidth + offset.x, y);
    columns[0].push(startPoint);
  }
  for (let i = 1, iLength = row.length; i < iLength; i++) {
    let tile = row[i];
    if (!this.collisionTiles.includes(tile.index)) {
      if (startPoint) {
        startPoint.neighbours = [endPoint];
        endPoint.neighbours = [startPoint];
        points.push(startPoint, endPoint);
        segments.push(new import_phaser6.Geom.Line(startPoint.x, startPoint.y, endPoint.x, endPoint.y));
        columns[i].push(endPoint);
        startPoint = false;
        endPoint = false;
      }
      continue;
    }
    let x = i * tileWidth + offset.x;
    if (!startPoint) {
      startPoint = new import_phaser6.Math.Vector2(x, y);
      columns[i].push(startPoint);
    }
    if (!endPoint) {
      endPoint = new import_phaser6.Math.Vector2(x + tileWidth, y);
    } else {
      endPoint.x = x + tileWidth;
    }
  }
  if (startPoint) {
    startPoint.neighbours = [endPoint];
    endPoint.neighbours = [startPoint];
    points.push(startPoint, endPoint);
    segments.push(new import_phaser6.Geom.Line(startPoint.x, startPoint.y, endPoint.x, endPoint.y));
    columns[row.length].push(endPoint);
  }
  for (let i = 0, iLength = columns.length; i < iLength; i++) {
    const column = columns[i];
    for (let j = 0, jLength = column.length - 1; j < jLength; j++) {
      segments.push(new import_phaser6.Geom.Line(column[j].x, column[j].y, column[j + 1].x, column[j + 1].y));
      column[j].neighbours.push(column[j + 1]);
      column[j + 1].neighbours.push(column[j]);
      j++;
    }
  }
  this._points = points;
  this._segments = segments;
  return this;
}
function setCollisionTiles(tiles = []) {
  this.collisionTiles = tiles;
  return this;
}
var import_phaser6;
var init_map_tilemap_methods = __esm({
  "node_modules/phaser-raycaster/src/map/map-tilemap-methods.js"() {
    import_phaser6 = __toESM(require_phaser());
  }
});

// node_modules/phaser-raycaster/src/map/map-matterBody-methods.js
var map_matterBody_methods_exports = {};
__export(map_matterBody_methods_exports, {
  getBoundingBox: () => getBoundingBox,
  getPoints: () => getPoints7,
  getSegments: () => getSegments7,
  updateMap: () => updateMap7
});
function getPoints7(ray = false) {
  if (!this.active)
    return [];
  let body = this.object.type === "body" || this.object.type === "composite" ? this.object : this.object.body;
  if (ray && !this.forceVerticesMapping && body.circleRadius > 0) {
    let points = [];
    let rayA = new import_phaser7.Geom.Line();
    let rayB = new import_phaser7.Geom.Line();
    let c = new import_phaser7.Geom.Line(ray.origin.x, ray.origin.y, body.position.x, body.position.y);
    let rayLength = Math.sqrt(Math.pow(import_phaser7.Geom.Line.Length(c), 2) - Math.pow(body.circleRadius * body.scale.x, 2));
    let angle = import_phaser7.Geom.Line.Angle(c);
    let dAngle = Math.asin(body.circleRadius * body.scale.x / import_phaser7.Geom.Line.Length(c));
    import_phaser7.Geom.Line.SetToAngle(rayA, ray.origin.x, ray.origin.y, angle - dAngle, rayLength);
    import_phaser7.Geom.Line.SetToAngle(rayB, ray.origin.x, ray.origin.y, angle + dAngle, rayLength);
    points.push(rayA.getPointB(), rayB.getPointB());
    return points;
  }
  return this._points;
}
function getSegments7() {
  if (!this.active)
    return [];
  return this._segments;
}
function updateMap7() {
  if (!this.active)
    return this;
  let points = [];
  let segments = [];
  let body = this.object.type === "body" || this.object.type === "composite" ? this.object : this.object.body;
  let bodies = [body];
  let generateBounds = false;
  if (body.circleRadius > 0 && !this.forceVerticesMapping) {
    this.circle = true;
    this._points = points;
    this._segments = segments;
    return this;
  }
  this.circle = false;
  if (body.type == "composite")
    bodies = body.bodies;
  if (body.bounds === void 0 && body.type == "composite" || body.type == "composite" && this.dynamic) {
    generateBounds = true;
  }
  for (let bodyItem of bodies) {
    if (bodyItem.parts.length === 1 || this.forceConvex) {
      let vertices = bodyItem.parts[0].vertices;
      points.push(new import_phaser7.Math.Vector2(vertices[0].x, vertices[0].y));
      points[0].neighbours = [];
      for (let i = 1, length = vertices.length; i < length; i++) {
        let pointA = points.slice(-1)[0], pointB = new import_phaser7.Math.Vector2(vertices[i].x, vertices[i].y);
        if (!pointA.neighbours)
          pointA.neighbours = [];
        pointA.neighbours.push(pointB);
        pointB.neighbours = [pointA];
        points.push(pointB);
        let segment2 = new import_phaser7.Geom.Line(pointA.x, pointA.y, pointB.x, pointB.y);
        segments.push(segment2);
      }
      let segment = new import_phaser7.Geom.Line(vertices[vertices.length - 1].x, vertices[vertices.length - 1].y, vertices[0].x, vertices[0].y);
      segments.push(segment);
      points[0].neighbours.push(points.slice(-1)[0]);
    } else {
      let parts = [], indexedPoints = [];
      for (let i = 1, iLength = bodyItem.parts.length; i < iLength; i++) {
        let vertices = bodyItem.parts[i].vertices, part = [];
        for (let j = 0, jLength = vertices.length; j < jLength; j++) {
          let point = new import_phaser7.Math.Vector2(vertices[j].x, vertices[j].y);
          if (part.length) {
            let prevPoint = part.slice(-1)[0];
            point.neighbours = [prevPoint];
            prevPoint.neighbours.push(point);
          } else {
            point.neighbours = [];
          }
          let index = vertices[j].x + "/" + vertices[j].y;
          if (indexedPoints[index] === void 0) {
            points.push(point);
            indexedPoints[index] = point;
          } else {
            indexedPoints[index].neighbours.push(point);
            point.neighbours.push(indexedPoints[index]);
          }
          part.push(point);
          if (vertices[j].isInternal) {
            parts.push(part);
            part = [];
          }
        }
        parts.push(part);
      }
      for (let part of parts) {
        let i = 0, iLength;
        for (i = 0, iLength = part.length - 1; i < iLength; i++) {
          segments.push(new import_phaser7.Geom.Line(part[i].x, part[i].y, part[i + 1].x, part[i + 1].y));
        }
      }
    }
  }
  this._points = points;
  this._segments = segments;
  if (generateBounds) {
    let bounds = this._raycaster.scene.matter.composite.bounds(body);
    body.bounds = bounds;
  }
  return this;
}
function getBoundingBox() {
  let bounds = this.object.type === "body" || this.object.type === "composite" ? this.object.bounds : this.object.body.bounds;
  return new import_phaser7.Geom.Rectangle(bounds.min.x, bounds.min.y, bounds.max.x - bounds.min.x, bounds.max.y - bounds.min.y);
}
var import_phaser7;
var init_map_matterBody_methods = __esm({
  "node_modules/phaser-raycaster/src/map/map-matterBody-methods.js"() {
    import_phaser7 = __toESM(require_phaser());
  }
});

// node_modules/phaser-raycaster/src/map/segmentsCount.js
var segmentsCount_exports = {};
__export(segmentsCount_exports, {
  setSegmentCount: () => setSegmentCount
});
function setSegmentCount(count) {
  this.segmentCount = count;
  this.circle = count ? false : true;
  this.updateMap();
  return this;
}
var init_segmentsCount = __esm({
  "node_modules/phaser-raycaster/src/map/segmentsCount.js"() {
  }
});

// node_modules/phaser-raycaster/src/map/boundingBox.js
var boundingBox_exports = {};
__export(boundingBox_exports, {
  getBoundingBox: () => getBoundingBox2
});
function getBoundingBox2() {
  return this.object.getBounds();
}
var init_boundingBox = __esm({
  "node_modules/phaser-raycaster/src/map/boundingBox.js"() {
  }
});

// node_modules/phaser-raycaster/src/map/config.js
var config_exports = {};
__export(config_exports, {
  config: () => config
});
function config(options) {
  this.object = options.object;
  if (options.type === void 0)
    options.type = options.object.type;
  if (options.type === "body" || options.type === "composite")
    options.type = "MatterBody";
  this.type = options.type;
  switch (options.type) {
    case "Polygon":
      this.getPoints = polygon.getPoints;
      this.getSegments = polygon.getSegments;
      this.getBoundingBox = boundingBox.getBoundingBox;
      this.updateMap = polygon.updateMap;
      break;
    case "Arc":
      this.segmentCount = options.segmentCount ? options.segmentCount : 0;
      this.circle = options.segmentCount ? false : true;
      this.getPoints = arc.getPoints;
      this.getSegments = arc.getSegments;
      this.getBoundingBox = boundingBox.getBoundingBox;
      this.updateMap = arc.updateMap;
      this.setSegmentCount = segmentCount.setSegmentCount;
      break;
    case "Line":
      this.getPoints = line.getPoints;
      this.getSegments = line.getSegments;
      this.getBoundingBox = boundingBox.getBoundingBox;
      this.updateMap = line.updateMap;
      break;
    case "Container":
      this.mapChild = options.mapChild ? options.mapChild : null;
      this.segmentCount = options.segmentCount ? options.segmentCount : 0;
      this._circles = [];
      this.getPoints = container.getPoints;
      this.getSegments = container.getSegments;
      this.getBoundingBox = boundingBox.getBoundingBox;
      this.updateMap = container.updateMap;
      this._updateChildMap = container._updateChildMap;
      this.setSegmentCount = segmentCount.setSegmentCount;
      break;
    case "StaticTilemapLayer":
      this.collisionTiles = options.collisionTiles ? options.collisionTiles : [];
      this.getPoints = tilemap.getPoints;
      this.getSegments = tilemap.getSegments;
      this.getBoundingBox = boundingBox.getBoundingBox;
      this.updateMap = tilemap.updateMap;
      this.setCollisionTiles = tilemap.setCollisionTiles;
      this.object.setOrigin(0, 0);
      break;
    case "DynamicTilemapLayer":
      this.collisionTiles = options.collisionTiles ? options.collisionTiles : [];
      this.getPoints = tilemap.getPoints;
      this.getSegments = tilemap.getSegments;
      this.getBoundingBox = boundingBox.getBoundingBox;
      this.updateMap = tilemap.updateMap;
      this.setCollisionTiles = tilemap.setCollisionTiles;
      this.object.setOrigin(0, 0);
      break;
    case "TilemapLayer":
      this.collisionTiles = options.collisionTiles ? options.collisionTiles : [];
      this.getPoints = tilemap.getPoints;
      this.getSegments = tilemap.getSegments;
      this.getBoundingBox = boundingBox.getBoundingBox;
      this.updateMap = tilemap.updateMap;
      this.setCollisionTiles = tilemap.setCollisionTiles;
      this.object.setOrigin(0, 0);
      break;
    case "MatterBody":
      this.forceConvex = options.forceConvex ? true : false;
      this.forceVerticesMapping = options.forceVerticesMapping ? true : false;
      this.circle = false;
      this.getPoints = matterBody.getPoints;
      this.getSegments = matterBody.getSegments;
      this.getBoundingBox = matterBody.getBoundingBox;
      this.updateMap = matterBody.updateMap;
      break;
    default:
      this.getPoints = rectangle.getPoints;
      this.getSegments = rectangle.getSegments;
      this.getBoundingBox = boundingBox.getBoundingBox;
      this.updateMap = rectangle.updateMap;
  }
  if (this.type != "MatterBody" && typeof this.object.getBounds !== "function") {
    this.notSupported = true;
  }
  this.dynamic = options.dynamic == true ? true : false;
  this.active = options.active !== void 0 ? options.active : true;
  return this;
}
var rectangle, line, polygon, arc, container, tilemap, matterBody, segmentCount, boundingBox;
var init_config = __esm({
  "node_modules/phaser-raycaster/src/map/config.js"() {
    rectangle = (init_map_rectangle_methods(), __toCommonJS(map_rectangle_methods_exports));
    line = (init_map_line_methods(), __toCommonJS(map_line_methods_exports));
    polygon = (init_map_polygon_methods(), __toCommonJS(map_polygon_methods_exports));
    arc = (init_map_circle_methods(), __toCommonJS(map_circle_methods_exports));
    container = (init_map_container_methods(), __toCommonJS(map_container_methods_exports));
    tilemap = (init_map_tilemap_methods(), __toCommonJS(map_tilemap_methods_exports));
    matterBody = (init_map_matterBody_methods(), __toCommonJS(map_matterBody_methods_exports));
    segmentCount = (init_segmentsCount(), __toCommonJS(segmentsCount_exports));
    boundingBox = (init_boundingBox(), __toCommonJS(boundingBox_exports));
  }
});

// node_modules/phaser-raycaster/src/map/destroy.js
var destroy_exports = {};
__export(destroy_exports, {
  destroy: () => destroy
});
function destroy() {
  if (this.object.type === "body" || this.object.type === "composite") {
    delete this.object.raycasterMap;
  } else if (this.object.data) {
    this.object.data.remove("raycasterMap");
  }
  for (let key in this) {
    delete this[key];
  }
}
var init_destroy = __esm({
  "node_modules/phaser-raycaster/src/map/destroy.js"() {
  }
});

// node_modules/phaser-raycaster/src/map/map-core.js
var map_core_exports = {};
__export(map_core_exports, {
  Map: () => Map
});
function Map(options, raycaster) {
  this._raycaster = raycaster ? raycaster : false;
  this.type;
  this.active;
  this._dynamic = false;
  this.circle = false;
  this.object;
  this._points = [];
  this._segments = [];
  this.getPoints;
  this.getSegments;
  this.getBoundingBox;
  this.updateMap;
  this.config(options);
  if (!this.notSupported)
    this.updateMap();
  return this;
}
var init_map_core = __esm({
  "node_modules/phaser-raycaster/src/map/map-core.js"() {
    Map.prototype = {
      config: (init_config(), __toCommonJS(config_exports)).config,
      destroy: (init_destroy(), __toCommonJS(destroy_exports)).destroy,
      get dynamic() {
        return this._dynamic;
      },
      set dynamic(dynamic) {
        if (this._dynamic == dynamic)
          return this;
        if (dynamic) {
          this._dynamic = true;
          if (this._raycaster) {
            this._raycaster.dynamicMappedObjects.push(this.object);
            this._raycaster._stats.mappedObjects.dynamic = this._raycaster.dynamicMappedObjects.length;
            this._raycaster._stats.mappedObjects.static = this._raycaster._stats.mappedObjects.total - this._raycaster._stats.mappedObjects.dynamic;
          }
        } else {
          this._dynamic = false;
          if (this._raycaster) {
            let index = this._raycaster.dynamicMappedObjects.indexOf(this.object);
            if (index >= 0)
              this._raycaster.dynamicMappedObjects.splice(index, 1);
            this._raycaster._stats.mappedObjects.dynamic = this._raycaster.dynamicMappedObjects.length;
            this._raycaster._stats.mappedObjects.static = this._raycaster._stats.mappedObjects.total - this._raycaster._stats.mappedObjects.dynamic;
          }
        }
        return this;
      }
    };
    Map.prototype.constructor = Map;
  }
});

// node_modules/phaser-raycaster/src/ray/config.js
var config_exports2 = {};
__export(config_exports2, {
  config: () => config2
});
function config2(options) {
  this.object = options.object;
  if (options.origin !== void 0)
    this.origin.setTo(options.origin.x, options.origin.y);
  if (options.angle !== void 0)
    this.angle = import_phaser8.Math.Angle.Normalize(options.angle);
  if (options.angleDeg !== void 0)
    this.angle = import_phaser8.Math.Angle.Normalize(import_phaser8.Math.DegToRad(options.angleDeg));
  if (options.cone !== void 0)
    this.cone = options.cone;
  if (options.coneDeg !== void 0)
    this.cone = import_phaser8.Math.DegToRad(options.coneDeg);
  if (options.rayRange !== void 0)
    this.rayRange = options.rayRange;
  if (options.collisionRange !== void 0)
    this.collisionRange = options.collisionRange;
  if (options.detectionRange !== void 0)
    this.detectionRange = options.detectionRange;
  if (options.ignoreNotIntersectedRays !== void 0)
    this.ignoreNotIntersectedRays = options.ignoreNotIntersectedRays == true;
  if (options.round !== void 0)
    this.round = options.round == true;
  if (options.autoSlice !== void 0)
    this.autoSlice = options.autoSlice == true;
  if (options.enablePhysics !== void 0 && options.enablePhysics)
    this.enablePhysics(options.enablePhysics);
  import_phaser8.Geom.Line.SetToAngle(this._ray, this.origin.x, this.origin.y, this.angle, this.rayRange);
  this.detectionRangeCircle.setTo(this.origin.x, this.origin.y, this.detectionRange);
  if (this._raycaster.debugOptions.enabled && this._raycaster.scene !== void 0) {
    this.graphics = this._raycaster.scene.add.graphics({ lineStyle: { width: 1, color: 65280 }, fillStyle: { color: 16711935 } });
    this.graphics.setDepth(1e3);
  }
  return this;
}
var import_phaser8;
var init_config2 = __esm({
  "node_modules/phaser-raycaster/src/ray/config.js"() {
    import_phaser8 = __toESM(require_phaser());
  }
});

// node_modules/phaser-raycaster/src/ray/stats.js
var stats_exports = {};
__export(stats_exports, {
  getStats: () => getStats
});
function getStats() {
  return this._stats;
}
var init_stats = __esm({
  "node_modules/phaser-raycaster/src/ray/stats.js"() {
  }
});

// node_modules/phaser-raycaster/src/ray/ray.js
var ray_exports = {};
__export(ray_exports, {
  setRay: () => setRay
});
function setRay(x, y, angle, rayRange = import_phaser9.Math.MAX_SAFE_INTEGER) {
  this.origin.setTo(x, y);
  this.angle = import_phaser9.Math.Angle.Normalize(angle);
  this.rayRange = rayRange;
  import_phaser9.Geom.Line.SetToAngle(this._ray, this.origin.x, this.origin.y, this.angle, this.rayRange);
  this.detectionRangeCircle.setTo(this.origin.x, this.origin.y, this.detectionRange);
  return this;
}
var import_phaser9;
var init_ray = __esm({
  "node_modules/phaser-raycaster/src/ray/ray.js"() {
    import_phaser9 = __toESM(require_phaser());
  }
});

// node_modules/phaser-raycaster/src/ray/origin.js
var origin_exports = {};
__export(origin_exports, {
  setOrigin: () => setOrigin
});
function setOrigin(x, y) {
  this.origin.setTo(x, y);
  import_phaser10.Geom.Line.SetToAngle(this._ray, this.origin.x, this.origin.y, this.angle, this.rayRange);
  this.detectionRangeCircle.setTo(this.origin.x, this.origin.y, this.detectionRange);
  if (this.bodyType === "matter" && this.collisionRange !== import_phaser10.Math.MAX_SAFE_INTEGER) {
    this.collisionCircle.x = x;
    this.collisionCircle.y = y;
  } else if (this.bodyType === "arcade") {
    this.collisionCircle.x = x;
    this.collisionCircle.y = y;
  }
  return this;
}
var import_phaser10;
var init_origin = __esm({
  "node_modules/phaser-raycaster/src/ray/origin.js"() {
    import_phaser10 = __toESM(require_phaser());
  }
});

// node_modules/phaser-raycaster/src/ray/range.js
var range_exports = {};
__export(range_exports, {
  boundsInRange: () => boundsInRange,
  setCollisionRange: () => setCollisionRange,
  setDetectionRange: () => setDetectionRange,
  setRayRange: () => setRayRange
});
function setRayRange(rayRange = import_phaser11.Math.MAX_SAFE_INTEGER) {
  this.rayRange = rayRange;
  import_phaser11.Geom.Line.SetToAngle(this._ray, this.origin.x, this.origin.y, this.angle, this.rayRange);
  return this;
}
function setDetectionRange(detectionRange = 0) {
  this.detectionRange = detectionRange;
  this.detectionRangeCircle.setTo(this.origin.x, this.origin.y, this.detectionRange);
  return this;
}
function setCollisionRange(collisionRange = import_phaser11.Math.MAX_SAFE_INTEGER) {
  let oldRangeMax = this.collisionRange == import_phaser11.Math.MAX_SAFE_INTEGER;
  this.collisionRange = collisionRange;
  this.collisionCircle.setRadius(this.collisionRange);
  if (this.bodyType === "matter") {
    if (this.collisionRange == import_phaser11.Math.MAX_SAFE_INTEGER) {
      let bounds = this._raycaster.boundingBox;
      this._raycaster.scene.matter.body.set(this.body, {
        shape: {
          type: "rectangle",
          x: bounds.rectangle.centerX,
          y: bounds.rectangle.centerY,
          width: bounds.rectangle.width,
          height: bounds.rectangle.height,
          circleRadius: 0
        }
      });
    } else if (oldRangeMax) {
      this._raycaster.scene.matter.body.set(this.body, {
        shape: {
          type: "circle",
          x: this.collisionCircle.x,
          y: this.collisionCircle.y
        },
        circleRadius: this.collisionRange,
        isStatic: false
      });
    } else {
      this.collisionCircle.setRadius(this.collisionRange);
    }
    this._raycaster.scene.matter.body.set(this.body, "circleRadius", this.collisionRange);
  } else if (this.bodyType === "arcade") {
    this.body.setCircle(this.collisionRange);
  }
  return this;
}
function boundsInRange(object, bounds = false) {
  if (!this.detectionRange)
    return true;
  let objectBounds;
  if (bounds)
    objectBounds = bounds;
  else {
    if (object.type === "body" || object.type === "composite")
      objectBounds = object.raycasterMap.getBoundingBox();
    else
      objectBounds = object.data.get("raycasterMap").getBoundingBox();
  }
  if (import_phaser11.Geom.Intersects.CircleToRectangle(this.detectionRangeCircle, objectBounds))
    return true;
  return false;
}
var import_phaser11;
var init_range = __esm({
  "node_modules/phaser-raycaster/src/ray/range.js"() {
    import_phaser11 = __toESM(require_phaser());
  }
});

// node_modules/phaser-raycaster/src/ray/angle.js
var angle_exports = {};
__export(angle_exports, {
  setAngle: () => setAngle,
  setAngleDeg: () => setAngleDeg
});
function setAngle(angle = 0) {
  this.angle = import_phaser12.Math.Angle.Normalize(angle);
  import_phaser12.Geom.Line.SetToAngle(this._ray, this.origin.x, this.origin.y, this.angle, this.rayRange);
  return this;
}
function setAngleDeg(angle = 0) {
  this.angle = import_phaser12.Math.Angle.Normalize(import_phaser12.Math.DegToRad(angle));
  import_phaser12.Geom.Line.SetToAngle(this._ray, this.origin.x, this.origin.y, this.angle, this.rayRange);
  return this;
}
var import_phaser12;
var init_angle = __esm({
  "node_modules/phaser-raycaster/src/ray/angle.js"() {
    import_phaser12 = __toESM(require_phaser());
  }
});

// node_modules/phaser-raycaster/src/ray/cone.js
var cone_exports = {};
__export(cone_exports, {
  setCone: () => setCone,
  setConeDeg: () => setConeDeg
});
function setCone(cone = 0) {
  this.cone = cone;
  return this;
}
function setConeDeg(cone = 0) {
  this.cone = import_phaser13.Math.DegToRad(cone);
  return this;
}
var import_phaser13;
var init_cone = __esm({
  "node_modules/phaser-raycaster/src/ray/cone.js"() {
    import_phaser13 = __toESM(require_phaser());
  }
});

// node_modules/phaser-raycaster/src/ray/cast.js
var cast_exports = {};
__export(cast_exports, {
  cast: () => cast
});
function cast(options = {}) {
  let closestIntersection;
  let closestSegment;
  let closestObject;
  let closestDistance = this.rayRange;
  let internal = options.internal ? options.internal : false;
  let startTime = performance.now();
  let stats = {
    method: "cast",
    rays: 1,
    testedMappedObjects: 0,
    hitMappedObjects: 0,
    segments: 0,
    time: 0
  };
  if (this._raycaster && this._raycaster.boundingBox) {
    let intersections2 = [];
    import_phaser14.Geom.Intersects.GetLineToRectangle(this._ray, this._raycaster.boundingBox.rectangle, intersections2);
    if (intersections2.length === 1)
      closestIntersection = intersections2[0];
    else if (intersections2.length > 1) {
      for (let intersection of intersections2) {
        let distance = import_phaser14.Math.Distance.Between(this.origin.x, this.origin.y, intersection.x, intersection.y);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIntersection = intersection;
        }
      }
    } else if (options.target) {
      let distance = import_phaser14.Math.Distance.Between(this.origin.x, this.origin.y, options.target.x, options.target.y);
      if (this.rayRange > distance) {
        closestDistance = distance;
        closestIntersection = options.target;
      }
    }
  }
  if (!options.objects) {
    if (this._raycaster)
      options.objects = this._raycaster.mappedObjects;
    else
      return intersections;
  }
  for (let object of options.objects) {
    let map, boundingBox2, boundingBoxIntersections = [], canTestMap = false;
    if (object.type === "body" || object.type === "composite")
      map = object.raycasterMap;
    else
      map = object.data.get("raycasterMap");
    stats.testedMappedObjects++;
    if (internal) {
      boundingBox2 = map._boundingBox;
    } else {
      boundingBox2 = map.getBoundingBox();
      boundingBox2.setTo(boundingBox2.x - 0.1, boundingBox2.y - 0.1, boundingBox2.width + 0.2, boundingBox2.height + 0.2);
    }
    if (import_phaser14.Geom.Intersects.GetLineToRectangle(this._ray, boundingBox2, boundingBoxIntersections).length === 0)
      continue;
    if (import_phaser14.Geom.Rectangle.ContainsPoint(boundingBox2, this.origin)) {
      canTestMap = true;
    } else {
      for (let boundingBoxIntersection of boundingBoxIntersections) {
        if (import_phaser14.Math.Distance.Between(this.origin.x, this.origin.y, boundingBoxIntersection.x, boundingBoxIntersection.y) < closestDistance) {
          canTestMap = true;
          break;
        }
      }
    }
    if (!canTestMap)
      continue;
    stats.hitMappedObjects++;
    stats.segments += map.getSegments(this).length;
    for (let segment of map.getSegments(this)) {
      let intersection = [];
      if (options.target) {
        if (options.target.equals(segment.getPointA()) || options.target.equals(segment.getPointB())) {
          intersection = options.target;
        } else if (!import_phaser14.Geom.Intersects.LineToLine(this._ray, segment, intersection))
          continue;
      } else if (!import_phaser14.Geom.Intersects.LineToLine(this._ray, segment, intersection))
        continue;
      let distance = import_phaser14.Math.Distance.Between(this.origin.x, this.origin.y, intersection.x, intersection.y);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIntersection = intersection;
        closestObject = map.object;
        closestSegment = segment;
      }
    }
    if (map.circle) {
      if (map._points.length > 0) {
        continue;
      }
      if (options.target) {
        let points = map.getPoints(this);
        let isTangent = false;
        for (let point of points) {
          if (point.equals(options.target)) {
            let distance = import_phaser14.Math.Distance.Between(this.origin.x, this.origin.y, point.x, point.y);
            if (distance < closestDistance) {
              closestDistance = distance;
              closestIntersection = point;
              closestObject = map.object;
              isTangent = true;
              break;
            }
          }
        }
        if (isTangent)
          continue;
      }
      let circleIntersections = [];
      let offset = new import_phaser14.Math.Vector2();
      offset.x = map.object.x - map.object.displayWidth * (map.object.originX - 0.5);
      offset.y = map.object.y - map.object.displayHeight * (map.object.originY - 0.5);
      let rotation = map.object.rotation;
      if (rotation !== 0) {
        let vector = new import_phaser14.Geom.Line(map.object.x, map.object.y, offset.x, offset.y);
        import_phaser14.Geom.Line.SetToAngle(vector, map.object.x, map.object.y, import_phaser14.Geom.Line.Angle(vector) + rotation, import_phaser14.Geom.Line.Length(vector));
        let cB = vector.getPointB();
        offset.x = cB.x;
        offset.y = cB.y;
      }
      let circle = new import_phaser14.Geom.Circle(offset.x, offset.y, map.object.radius * map.object.scaleX);
      if (import_phaser14.Geom.Intersects.GetLineToCircle(this._ray, circle, circleIntersections)) {
        for (let intersection of circleIntersections) {
          let distance = import_phaser14.Math.Distance.Between(this._ray.x1, this._ray.y1, intersection.x, intersection.y);
          if (distance < closestDistance) {
            closestDistance = distance;
            closestIntersection = intersection;
            closestObject = map.object;
          }
        }
      }
    }
    if (map.type == "Container" && map._circles.length > 0) {
      for (let circle of map._circles) {
        if (options.target) {
          let isTangent = false;
          for (let point of circle.points) {
            if (point.equals(options.target)) {
              let distance = import_phaser14.Math.Distance.Between(this.origin.x, this.origin.y, point.x, point.y);
              if (distance < closestDistance) {
                closestDistance = distance;
                closestIntersection = point;
                closestObject = map.object;
                isTangent = true;
                break;
              }
            }
          }
          if (isTangent)
            continue;
        }
        let circleIntersections = [];
        if (import_phaser14.Geom.Intersects.GetLineToCircle(this._ray, circle, circleIntersections)) {
          for (let intersection of circleIntersections) {
            let distance = import_phaser14.Math.Distance.Between(this._ray.x1, this._ray.y1, intersection.x, intersection.y);
            if (distance < closestDistance) {
              closestDistance = distance;
              closestIntersection = intersection;
              closestObject = map.object;
            }
          }
        }
      }
    }
  }
  if (internal) {
    this._stats.rays++;
    this._stats.testedMappedObjects += stats.testedMappedObjects;
    this._stats.hitMappedObjects += stats.hitMappedObjects;
    this._stats.segments += stats.segments;
  } else {
    stats.time = performance.now() - startTime;
    this._stats = stats;
  }
  let result;
  if (!closestIntersection) {
    if (this.ignoreNotIntersectedRays)
      return false;
    result = this._ray.getPointB();
  } else {
    result = new import_phaser14.Math.Vector2(closestIntersection.x, closestIntersection.y);
    result.segment = closestSegment;
    result.object = closestObject;
  }
  if (this.round) {
    result.x = Math.round(result.x);
    result.y = Math.round(result.y);
  }
  if (!internal)
    this.drawDebug([result]);
  return result;
}
var import_phaser14;
var init_cast = __esm({
  "node_modules/phaser-raycaster/src/ray/cast.js"() {
    import_phaser14 = __toESM(require_phaser());
  }
});

// node_modules/phaser-raycaster/src/ray/castCircle.js
var castCircle_exports = {};
__export(castCircle_exports, {
  castCircle: () => castCircle
});
function castCircle(options = {}) {
  let originalAngle = this.angle;
  let intersections2 = [];
  let maps = [];
  let rayTargets = [];
  let testedObjects = [];
  let startTime = performance.now();
  this._stats = {
    method: "castCircle",
    rays: 0,
    testedMappedObjects: 0,
    hitMappedObjects: 0,
    segments: 0,
    time: 0
  };
  if (!options.objects) {
    if (this._raycaster)
      options.objects = this._raycaster.mappedObjects;
    else
      return intersections2;
  }
  if (this._raycaster && this._raycaster.boundingBox) {
    for (let point of this._raycaster.boundingBox.points) {
      rayTargets.push({
        point,
        angle: import_phaser15.Math.Angle.Between(this.origin.x, this.origin.y, point.x, point.y)
      });
    }
  }
  for (let i = 0, iLength = options.objects.length; i < iLength; i++) {
    let object = options.objects[i];
    if (!this.boundsInRange(object))
      continue;
    testedObjects.push(object);
    let map, boundingBox2;
    if (object.type === "body" || object.type === "composite")
      map = object.raycasterMap;
    else
      map = object.data.get("raycasterMap");
    boundingBox2 = map.getBoundingBox();
    boundingBox2.setTo(boundingBox2.x - 0.1, boundingBox2.y - 0.1, boundingBox2.width + 0.2, boundingBox2.height + 0.2);
    map._boundingBox = boundingBox2;
    maps.push(map);
    for (let point of map.getPoints(this)) {
      rayTargets.push({
        point,
        angle: import_phaser15.Math.Angle.Between(this.origin.x, this.origin.y, point.x, point.y)
      });
    }
    for (let j = i + 1, jLength = options.objects.length; j < jLength; j++) {
      let objectB = options.objects[j];
      let mapB;
      if (objectB.type === "body" || objectB.type === "composite")
        mapB = objectB.raycasterMap;
      else {
        mapB = objectB.data.get("raycasterMap");
      }
      if (!import_phaser15.Geom.Intersects.RectangleToRectangle(map.getBoundingBox(), mapB.getBoundingBox()))
        continue;
      for (let segmentA of map.getSegments(this)) {
        for (let segmentB of mapB.getSegments(this)) {
          let intersection = [];
          if (!import_phaser15.Geom.Intersects.LineToLine(segmentA, segmentB, intersection))
            continue;
          let target = {
            point: new import_phaser15.Math.Vector2(intersection.x, intersection.y),
            angle: import_phaser15.Math.Angle.Between(this.origin.x, this.origin.y, intersection.x, intersection.y)
          };
          target.point.intersection = false;
          rayTargets.push(target);
        }
      }
    }
  }
  rayTargets.sort((function(a, b) {
    if (a.angle == b.angle) {
      if (import_phaser15.Math.Distance.Between(this.origin.x, this.origin.y, a.point.x, a.point.y) > import_phaser15.Math.Distance.Between(this.origin.x, this.origin.y, b.point.x, b.point.y))
        return 1;
      else
        return -1;
    }
    return a.angle - b.angle;
  }).bind(this));
  let previousTarget = {
    angle: false
  };
  for (let target of rayTargets) {
    if (target.angle === previousTarget.angle) {
      continue;
    }
    previousTarget = target;
    this.setAngle(target.angle);
    let intersection = this.cast({
      objects: testedObjects,
      target: target.point,
      internal: true
    });
    if (intersection) {
      let castSides = false;
      if (this.round) {
        let roundedTarget = new import_phaser15.Math.Vector2(Math.round(target.point.x), Math.round(target.point.y));
        castSides = roundedTarget.equals(intersection);
      } else {
        castSides = target.point.equals(intersection);
      }
      if (!castSides) {
      } else if (!target.point.neighbours || target.point.neighbours.length < 2) {
      } else if (import_phaser15.Math.Angle.Normalize(this.angle - import_phaser15.Math.Angle.BetweenPoints(this.origin, target.point.neighbours[0])) < 1e-4 || import_phaser15.Math.Angle.Normalize(this.angle - import_phaser15.Math.Angle.BetweenPoints(this.origin, target.point.neighbours[1])) < 1e-4) {
      } else {
        let triangleIntersections = [];
        if (!target.point.neighboursTriangle) {
          target.point.neighboursTriangle = new import_phaser15.Geom.Triangle(target.point.x, target.point.y, target.point.neighbours[0].x, target.point.neighbours[0].y, target.point.neighbours[1].x, target.point.neighbours[1].y);
        }
        import_phaser15.Geom.Intersects.GetTriangleToLine(target.point.neighboursTriangle, this._ray, triangleIntersections);
        for (let triangleIntersection of triangleIntersections) {
          if (Math.abs(target.point.x - triangleIntersection.x) > 1e-4 && Math.abs(target.point.y - triangleIntersection.y) > 1e-4) {
            castSides = false;
            break;
          }
        }
      }
      if (castSides) {
        this.setAngle(target.angle - 1e-4);
        let intersectionA = this.cast({
          objects: testedObjects,
          internal: true
        });
        if (intersectionA) {
          intersections2.push(intersectionA);
        }
        intersections2.push(intersection);
        this.setAngle(target.angle + 1e-4);
        let intersectionB = this.cast({
          objects: testedObjects,
          internal: true
        });
        if (intersectionB) {
          intersections2.push(intersectionB);
        }
        continue;
      }
      intersections2.push(intersection);
    }
  }
  this.setAngle(originalAngle);
  this.intersections = intersections2;
  if (this.autoSlice)
    this.slicedIntersections = this.slice();
  this._stats.time = performance.now() - startTime;
  this.drawDebug(intersections2);
  return intersections2;
}
var import_phaser15;
var init_castCircle = __esm({
  "node_modules/phaser-raycaster/src/ray/castCircle.js"() {
    import_phaser15 = __toESM(require_phaser());
  }
});

// node_modules/phaser-raycaster/src/ray/castCone.js
var castCone_exports = {};
__export(castCone_exports, {
  castCone: () => castCone
});
function castCone(options = {}) {
  let originalAngle = this.angle;
  let intersections2 = [];
  let maps = [];
  let rayTargets = [];
  let testedObjects = [];
  let cone = this.cone;
  let minAngle = 0;
  let maxAngle = 0;
  let angleOffset = 0;
  let startTime = performance.now();
  this._stats = {
    method: "castCone",
    rays: 0,
    testedMappedObjects: 0,
    hitMappedObjects: 0,
    segments: 0,
    time: 0
  };
  if (options.cone !== void 0)
    cone = options.cone;
  if (options.coneDeg !== void 0)
    cone = import_phaser16.Math.DegToRad(options.coneDeg);
  minAngle = this.angle - cone / 2;
  maxAngle = this.angle + cone / 2;
  this.setAngle(minAngle);
  rayTargets.push({
    point: this._ray.getPointB(),
    angle: minAngle,
    angleOffsetDeg: import_phaser16.Math.RadToDeg(-cone / 2)
  });
  this.setAngle(maxAngle);
  rayTargets.push({
    point: this._ray.getPointB(),
    angle: maxAngle,
    angleOffsetDeg: import_phaser16.Math.RadToDeg(cone / 2)
  });
  if (!options.objects) {
    if (this._raycaster)
      options.objects = this._raycaster.mappedObjects;
    else
      return intersections2;
  }
  if (this._raycaster && this._raycaster.boundingBox) {
    for (let point of this._raycaster.boundingBox.points) {
      let angle = import_phaser16.Math.Angle.Between(this.origin.x, this.origin.y, point.x, point.y);
      let angleOffsetDeg = import_phaser16.Math.Angle.ShortestBetween(import_phaser16.Math.RadToDeg(angle), import_phaser16.Math.RadToDeg(originalAngle));
      if (Math.abs(angleOffsetDeg) < import_phaser16.Math.RadToDeg(cone / 2)) {
        rayTargets.push({
          point,
          angle,
          angleOffsetDeg: -angleOffsetDeg
        });
      }
    }
  }
  for (let i = 0, iLength = options.objects.length; i < iLength; i++) {
    let object = options.objects[i];
    if (!this.boundsInRange(object))
      continue;
    testedObjects.push(object);
    let map, boundingBox2;
    if (object.type === "body" || object.type === "composite")
      map = object.raycasterMap;
    else
      map = object.data.get("raycasterMap");
    boundingBox2 = map.getBoundingBox();
    boundingBox2.setTo(boundingBox2.x - 0.1, boundingBox2.y - 0.1, boundingBox2.width + 0.2, boundingBox2.height + 0.2);
    map._boundingBox = boundingBox2;
    maps.push(map);
    for (let point of map.getPoints(this)) {
      let angle = import_phaser16.Math.Angle.Between(this.origin.x, this.origin.y, point.x, point.y);
      let angleOffsetDeg = import_phaser16.Math.Angle.ShortestBetween(import_phaser16.Math.RadToDeg(angle), import_phaser16.Math.RadToDeg(originalAngle));
      if (Math.abs(angleOffsetDeg) < import_phaser16.Math.RadToDeg(cone / 2)) {
        rayTargets.push({
          point,
          angle: import_phaser16.Math.Angle.Between(this.origin.x, this.origin.y, point.x, point.y),
          angleOffsetDeg: -angleOffsetDeg
        });
      }
    }
    for (let j = i + 1, jLength = options.objects.length; j < jLength; j++) {
      let objectB = options.objects[j];
      let mapB;
      if (objectB.type === "body" || objectB.type === "composite")
        mapB = objectB.raycasterMap;
      else
        mapB = objectB.data.get("raycasterMap");
      if (!import_phaser16.Geom.Intersects.RectangleToRectangle(map.getBoundingBox(), mapB.getBoundingBox()))
        continue;
      for (let segmentA of map.getSegments(this)) {
        for (let segmentB of mapB.getSegments(this)) {
          let intersection = [];
          if (!import_phaser16.Geom.Intersects.LineToLine(segmentA, segmentB, intersection))
            continue;
          let angle = import_phaser16.Math.Angle.Between(this.origin.x, this.origin.y, intersection.x, intersection.y);
          let angleOffsetDeg = Math.Angle.ShortestBetween(import_phaser16.Math.RadToDeg(angle), import_phaser16.Math.RadToDeg(originalAngle));
          if (Math.abs(angleOffsetDeg) < import_phaser16.Math.RadToDeg(cone / 2)) {
            rayTargets.push({
              point: new import_phaser16.Math.Vector2(intersection.x, intersection.y),
              angle: import_phaser16.Math.Angle.Between(this.origin.x, this.origin.y, intersection.x, intersection.y),
              angleOffsetDeg: -angleOffsetDeg
            });
          }
        }
      }
    }
  }
  rayTargets.sort((function(a, b) {
    if (a.angle == b.angle) {
      if (import_phaser16.Math.Distance.Between(this.origin.x, this.origin.y, a.point.x, a.point.y) > import_phaser16.Math.Distance.Between(this.origin.x, this.origin.y, b.point.x, b.point.y))
        return 1;
      else
        return -1;
    }
    return a.angleOffsetDeg - b.angleOffsetDeg;
  }).bind(this));
  let previousTarget = {
    angle: false
  };
  for (let target of rayTargets) {
    if (target.angle === previousTarget.angle) {
      continue;
    }
    previousTarget = target;
    this.setAngle(target.angle);
    let intersection = this.cast({
      objects: testedObjects,
      target: target.point,
      internal: true
    });
    if (intersection) {
      let castSides = false;
      if (this.round) {
        let roundedTarget = new import_phaser16.Math.Vector2(Math.round(target.point.x), Math.round(target.point.y));
        castSides = roundedTarget.equals(intersection);
      } else {
        castSides = target.point.equals(intersection);
      }
      if (!castSides) {
      } else if (!target.point.neighbours || target.point.neighbours.length < 2) {
      } else if (import_phaser16.Math.Angle.Normalize(this.angle - import_phaser16.Math.Angle.BetweenPoints(this.origin, target.point.neighbours[0])) < 1e-4 || import_phaser16.Math.Angle.Normalize(this.angle - import_phaser16.Math.Angle.BetweenPoints(this.origin, target.point.neighbours[1])) < 1e-4) {
      } else {
        let triangleIntersections = [];
        if (!target.point.neighboursTriangle) {
          target.point.neighboursTriangle = new import_phaser16.Geom.Triangle(target.point.x, target.point.y, target.point.neighbours[0].x, target.point.neighbours[0].y, target.point.neighbours[1].x, target.point.neighbours[1].y);
        }
        import_phaser16.Geom.Intersects.GetTriangleToLine(target.point.neighboursTriangle, this._ray, triangleIntersections);
        for (let triangleIntersection of triangleIntersections) {
          if (Math.abs(target.point.x - triangleIntersection.x) > 1e-4 && Math.abs(target.point.y - triangleIntersection.y) > 1e-4) {
            castSides = false;
            break;
          }
        }
      }
      if (castSides) {
        this.setAngle(target.angle - 1e-4);
        let intersectionA = this.cast({
          objects: testedObjects,
          internal: true
        });
        if (intersectionA) {
          intersections2.push(intersectionA);
        }
        intersections2.push(intersection);
        this.setAngle(target.angle + 1e-4);
        let intersectionB = this.cast({
          objects: testedObjects,
          internal: true
        });
        if (intersectionB) {
          intersections2.push(intersectionB);
        }
        continue;
      }
      intersections2.push(intersection);
    }
  }
  this.setAngle(originalAngle);
  this.intersections = intersections2;
  if (this.autoSlice)
    this.slicedIntersections = this.slice(intersections2, false);
  this._stats.time = performance.now() - startTime;
  this.drawDebug(intersections2);
  return intersections2;
}
var import_phaser16;
var init_castCone = __esm({
  "node_modules/phaser-raycaster/src/ray/castCone.js"() {
    import_phaser16 = __toESM(require_phaser());
  }
});

// node_modules/phaser-raycaster/src/ray/slice.js
var slice_exports = {};
__export(slice_exports, {
  slice: () => slice
});
function slice(intersections2 = this.intersections, closed = true) {
  if (!Array.isArray(intersections2)) {
    if (intersections2.type === 4)
      intersections2 = intersections2.points;
    else
      return [];
  }
  if (intersections2.length === 0)
    return [];
  let slices = [];
  for (let i = 0, iLength = intersections2.length - 1; i < iLength; i++) {
    slices.push(new import_phaser17.Geom.Triangle(this.origin.x, this.origin.y, intersections2[i].x, intersections2[i].y, intersections2[i + 1].x, intersections2[i + 1].y));
  }
  if (closed)
    slices.push(new import_phaser17.Geom.Triangle(this.origin.x, this.origin.y, intersections2[0].x, intersections2[0].y, intersections2[intersections2.length - 1].x, intersections2[intersections2.length - 1].y));
  return slices;
}
var import_phaser17;
var init_slice = __esm({
  "node_modules/phaser-raycaster/src/ray/slice.js"() {
    import_phaser17 = __toESM(require_phaser());
  }
});

// node_modules/phaser-raycaster/src/ray/enablePhysics.js
var enablePhysics_exports = {};
__export(enablePhysics_exports, {
  enablePhysics: () => enablePhysics
});
function enablePhysics(type = "arcade") {
  if (this.body !== void 0)
    return this;
  this.collisionCircle = this._raycaster.scene.add.circle(this.origin.x, this.origin.y, this.collisionRange);
  this.collisionCircle._ray = this;
  if (type === "matter") {
    this.bodyType = "matter";
    if (this.collisionRange == import_phaser18.Math.MAX_SAFE_INTEGER) {
      let bounds = this._raycaster.boundingBox;
      this._raycaster.scene.matter.add.gameObject(this.collisionCircle, { shape: { type: "rectangle", x: bounds.rectangle.centerX, y: bounds.rectangle.centerY, width: bounds.rectangle.width, height: bounds.rectangle.height }, label: "phaser-raycaster-ray-body", isSensor: true, ignoreGravity: true });
    } else {
      this._raycaster.scene.matter.add.gameObject(this.collisionCircle, { shape: { type: "circle" }, label: "phaser-raycaster-ray-body", isSensor: true, ignoreGravity: true });
    }
    this.body = this.collisionCircle.body;
    this.body._ray = this;
    this.setOnCollideActive();
  } else {
    this.bodyType = "arcade";
    this._raycaster.scene.physics.add.existing(this.collisionCircle);
    this.body = this.collisionCircle.body;
    this.body.setCircle(this.collisionRange).setAllowGravity(false).setImmovable(true);
    this.body._ray = this;
  }
  return this;
}
var import_phaser18;
var init_enablePhysics = __esm({
  "node_modules/phaser-raycaster/src/ray/enablePhysics.js"() {
    import_phaser18 = __toESM(require_phaser());
  }
});

// node_modules/phaser-raycaster/src/ray/overlap.js
var overlap_exports = {};
__export(overlap_exports, {
  overlap: () => overlap,
  processOverlap: () => processOverlap,
  testArcadeOverlap: () => testArcadeOverlap,
  testMatterOverlap: () => testMatterOverlap
});
function overlap(objects) {
  let targets = [];
  let overlapCircle = new import_phaser19.Geom.Circle(this.origin.x, this.origin.y, this.collisionRange);
  if (this.bodyType === "matter") {
    let isCollisionInfo = false;
    if (objects === void 0) {
      objects = this._raycaster.scene.matter.query.collides(this.body, this._raycaster.scene.matter.getMatterBodies());
      for (let object of objects) {
        let body = object.bodyA === this.body ? object.bodyB : object.bodyA;
        if (this.testMatterOverlap(body))
          targets.push(body);
      }
    } else {
      if (!Array.isArray(objects))
        objects = [objects];
      for (let object of objects) {
        if (object === this.body)
          continue;
        if (this.testMatterOverlap(object))
          targets.push(object);
      }
    }
  } else {
    let bodies = false;
    if (objects === void 0) {
      objects = this._raycaster.scene.physics.overlapCirc(this.origin.x, this.origin.y, this.collisionRange, true, true);
      bodies = true;
    } else if (!Array.isArray(objects)) {
      objects = [objects];
    }
    if (bodies) {
      for (let body of objects) {
        if (body === this.body)
          continue;
        let hitbox;
        if (body.isCircle) {
          hitbox = new import_phaser19.Geom.Circle(body.position.x + body.halfWidth, body.position.y + body.halfWidth, body.halfWidth);
        } else {
          hitbox = new import_phaser19.Geom.Rectangle(body.x, body.y, body.width, body.height);
        }
        if (this.testArcadeOverlap(hitbox))
          targets.push(body.gameObject);
      }
    } else {
      for (let object of objects) {
        if (object.body === void 0)
          continue;
        let hitbox;
        if (object.body.isCircle) {
          hitbox = new import_phaser19.Geom.Circle(object.body.position.x + object.body.halfWidth, object.body.position.y + object.body.halfWidth, object.body.halfWidth);
          if (!import_phaser19.Geom.Intersects.CircleToCircle(overlapCircle, hitbox))
            continue;
        } else {
          hitbox = new import_phaser19.Geom.Rectangle(object.body.x, object.body.y, object.body.width, object.body.height);
          if (!import_phaser19.Geom.Intersects.CircleToRectangle(overlapCircle, hitbox))
            continue;
        }
        if (this.testArcadeOverlap(hitbox))
          targets.push(object);
      }
    }
  }
  return targets;
}
function processOverlap(object1, object2) {
  let obj1, obj2, target;
  if (object1.bodyA !== void 0 && object1.bodyB !== void 0) {
    obj1 = object1.bodyA;
    obj2 = object1.bodyB;
  } else {
    obj1 = object1;
    obj2 = object2;
  }
  if (obj1._ray !== void 0 && obj1._ray === this)
    target = obj2;
  else if (obj2._ray !== void 0 && obj2._ray === this)
    target = obj1;
  else
    return false;
  return this.overlap(target).length > 0;
}
function testArcadeOverlap(hitbox) {
  let overlap2 = false;
  for (let slice2 of this.slicedIntersections) {
    if (hitbox.type == 0) {
      overlap2 = import_phaser19.Geom.Intersects.TriangleToCircle(slice2, hitbox);
    } else {
      overlap2 = import_phaser19.Geom.Intersects.RectangleToTriangle(hitbox, slice2);
    }
    if (overlap2) {
      return true;
    }
  }
  return false;
}
function testMatterOverlap(object) {
  let body;
  if (object.type === "body")
    body = object;
  else if (object.body !== void 0)
    body = object.body;
  else
    return false;
  let parts = body.parts.length > 1 ? body.parts.splice(1) : body.parts;
  for (let part of parts) {
    let pointA = part.vertices[0];
    for (let i = 1, length = part.vertices.length; i < length; i++) {
      let pointB = part.vertices[i];
      let segment2 = new import_phaser19.Geom.Line(pointA.x, pointA.y, pointB.x, pointB.y);
      for (let slice2 of this.slicedIntersections) {
        let overlap2 = import_phaser19.Geom.Intersects.TriangleToLine(slice2, segment2);
        if (!overlap2)
          overlap2 = import_phaser19.Geom.Triangle.ContainsPoint(slice2, segment2.getPointA());
        if (!overlap2)
          overlap2 = import_phaser19.Geom.Triangle.ContainsPoint(slice2, segment2.getPointB());
        if (overlap2) {
          return true;
        }
      }
      pointA = pointB;
    }
    let segment = new import_phaser19.Geom.Line(part.vertices[part.vertices.length - 1].x, part.vertices[part.vertices.length - 1].y, part.vertices[0].x, part.vertices[0].y);
    for (let slice2 of this.slicedIntersections) {
      let overlap2 = import_phaser19.Geom.Intersects.TriangleToLine(slice2, segment);
      if (overlap2) {
        return true;
      }
    }
  }
  return false;
}
var import_phaser19;
var init_overlap = __esm({
  "node_modules/phaser-raycaster/src/ray/overlap.js"() {
    import_phaser19 = __toESM(require_phaser());
  }
});

// node_modules/phaser-raycaster/src/ray/matter-physics-methods.js
var matter_physics_methods_exports = {};
__export(matter_physics_methods_exports, {
  setCollidesWith: () => setCollidesWith,
  setCollisionCategory: () => setCollisionCategory,
  setCollisionGroup: () => setCollisionGroup,
  setOnCollide: () => setOnCollide,
  setOnCollideActive: () => setOnCollideActive,
  setOnCollideEnd: () => setOnCollideEnd,
  setOnCollideWith: () => setOnCollideWith
});
function setCollisionCategory(value) {
  this.body.collisionFilter.category = value;
  return this;
}
function setCollisionGroup(value) {
  this.body.collisionFilter.group = value;
  return this;
}
function setCollidesWith(categories) {
  var flags = 0;
  if (!Array.isArray(categories)) {
    flags = categories;
  } else {
    for (var i = 0; i < categories.length; i++) {
      flags |= categories[i];
    }
  }
  this.body.collisionFilter.mask = flags;
  return this;
}
function setOnCollide(callback) {
  let self = this;
  this.body.onCollideCallback = function(collisionInfo) {
    if (collisionInfo.rayCollided) {
      callback(collisionInfo);
    } else if (self.processOverlap(collisionInfo)) {
      collisionInfo.rayCollided = true;
      callback(collisionInfo);
    }
  };
  return this;
}
function setOnCollideEnd(callback) {
  this.body.onCollideEndCallback = function(collisionInfo) {
    if (collisionInfo.rayCollided) {
      collisionInfo.rayCollided = false;
      callback(collisionInfo);
    }
  };
  return this;
}
function setOnCollideActive(callback) {
  let self = this;
  let func = function(collisionInfo) {
    if (self.processOverlap(collisionInfo)) {
      let body = collisionInfo.bodyA.label === "phaser-raycaster-ray-body" ? collisionInfo.bodyB : collisionInfo.bodyA;
      if (collisionInfo.rayCollided !== true) {
        collisionInfo.rayCollided = true;
        if (self.body.onCollideCallback) {
          self.body.onCollideCallback(collisionInfo);
        }
        if (self.body.onCollideWith !== void 0 && self.body.onCollideWith[body.id]) {
          self.body.onCollideWith[body.id](body, collisionInfo);
        }
      }
      if (callback)
        callback(collisionInfo);
    } else {
      if (self.body.onCollideEndCallback && collisionInfo.rayCollided === true) {
        self.body.onCollideEndCallback(collisionInfo);
      }
    }
  };
  this.body.onCollideActiveCallback = func;
  return this;
}
function setOnCollideWith(body, callback) {
  let self = this;
  let func = function(body2, collisionInfo) {
    if (collisionInfo.rayCollided) {
      callback(body2, collisionInfo);
    } else if (self.processOverlap(collisionInfo)) {
      collisionInfo.rayCollided = true;
      callback(body2, collisionInfo);
    }
  };
  if (!Array.isArray(body)) {
    body = [body];
  }
  for (var i = 0; i < body.length; i++) {
    var src = body[i].hasOwnProperty("body") ? body[i].body : body[i];
    this.body.setOnCollideWith(src, func);
  }
  return this;
}
var init_matter_physics_methods = __esm({
  "node_modules/phaser-raycaster/src/ray/matter-physics-methods.js"() {
  }
});

// node_modules/phaser-raycaster/src/ray/debug.js
var debug_exports = {};
__export(debug_exports, {
  drawDebug: () => drawDebug
});
function drawDebug(intersections2) {
  if (this.graphics === void 0 || !this._raycaster.debugOptions.enabled)
    return this;
  this.graphics.clear();
  if (!this._raycaster.debugOptions.rays)
    return this;
  if (this._raycaster.debugOptions.graphics.ray) {
    this.graphics.lineStyle(1, this._raycaster.debugOptions.graphics.ray);
    for (let intersection of intersections2) {
      this.graphics.strokeLineShape({
        x1: this.origin.x,
        y1: this.origin.y,
        x2: intersection.x,
        y2: intersection.y
      });
    }
  }
  if (this._raycaster.debugOptions.graphics.rayPoint) {
    this.graphics.fillStyle(this._raycaster.debugOptions.graphics.rayPoint);
    this.graphics.fillPoint(this.origin.x, this.origin.y, 3);
    for (let intersection of intersections2) {
      this.graphics.fillPoint(intersection.x, intersection.y, 3);
    }
  }
  return this;
}
var init_debug = __esm({
  "node_modules/phaser-raycaster/src/ray/debug.js"() {
  }
});

// node_modules/phaser-raycaster/src/ray/destroy.js
var destroy_exports2 = {};
__export(destroy_exports2, {
  destroy: () => destroy2
});
function destroy2() {
  if (this.graphics)
    this.graphics.destroy();
  for (let key in this) {
    delete this[key];
  }
}
var init_destroy2 = __esm({
  "node_modules/phaser-raycaster/src/ray/destroy.js"() {
  }
});

// node_modules/phaser-raycaster/src/ray/ray-core.js
var ray_core_exports = {};
__export(ray_core_exports, {
  Ray: () => Ray
});
function Ray(options, raycaster) {
  this._raycaster = raycaster ? raycaster : false;
  this.origin = new import_phaser20.Math.Vector2();
  this._ray = new import_phaser20.Geom.Line();
  this.angle = 0;
  this.cone = 0;
  this.rayRange = import_phaser20.Math.MAX_SAFE_INTEGER;
  this.detectionRange = 0;
  this.detectionRangeCircle = new import_phaser20.Geom.Circle();
  this.collisionRange = import_phaser20.Math.MAX_SAFE_INTEGER;
  this.ignoreNotIntersectedRays = true;
  this.round = false;
  this.autoSlice = false;
  this.intersections = [];
  this.slicedIntersections = [];
  this.bodyType = false;
  this._stats = {
    method: "cast",
    rays: 0,
    testedMappedObjects: 0,
    hitMappedObjects: 0,
    segments: 0,
    time: 0
  };
  this.graphics;
  this.config(options);
}
var import_phaser20;
var init_ray_core = __esm({
  "node_modules/phaser-raycaster/src/ray/ray-core.js"() {
    import_phaser20 = __toESM(require_phaser());
    Ray.prototype = {
      config: (init_config2(), __toCommonJS(config_exports2)).config,
      getStats: (init_stats(), __toCommonJS(stats_exports)).getStats,
      setRay: (init_ray(), __toCommonJS(ray_exports)).setRay,
      setOrigin: (init_origin(), __toCommonJS(origin_exports)).setOrigin,
      setRayRange: (init_range(), __toCommonJS(range_exports)).setRayRange,
      setAngle: (init_angle(), __toCommonJS(angle_exports)).setAngle,
      setAngleDeg: (init_angle(), __toCommonJS(angle_exports)).setAngleDeg,
      setCone: (init_cone(), __toCommonJS(cone_exports)).setCone,
      setConeDeg: (init_cone(), __toCommonJS(cone_exports)).setConeDeg,
      setDetectionRange: (init_range(), __toCommonJS(range_exports)).setDetectionRange,
      boundsInRange: (init_range(), __toCommonJS(range_exports)).boundsInRange,
      cast: (init_cast(), __toCommonJS(cast_exports)).cast,
      castCircle: (init_castCircle(), __toCommonJS(castCircle_exports)).castCircle,
      castCone: (init_castCone(), __toCommonJS(castCone_exports)).castCone,
      slice: (init_slice(), __toCommonJS(slice_exports)).slice,
      setCollisionRange: (init_range(), __toCommonJS(range_exports)).setCollisionRange,
      enablePhysics: (init_enablePhysics(), __toCommonJS(enablePhysics_exports)).enablePhysics,
      overlap: (init_overlap(), __toCommonJS(overlap_exports)).overlap,
      processOverlap: (init_overlap(), __toCommonJS(overlap_exports)).processOverlap,
      testArcadeOverlap: (init_overlap(), __toCommonJS(overlap_exports)).testArcadeOverlap,
      testMatterOverlap: (init_overlap(), __toCommonJS(overlap_exports)).testMatterOverlap,
      setCollisionCategory: (init_matter_physics_methods(), __toCommonJS(matter_physics_methods_exports)).setCollisionCategory,
      setCollisionGroup: (init_matter_physics_methods(), __toCommonJS(matter_physics_methods_exports)).setCollisionGroup,
      setCollidesWith: (init_matter_physics_methods(), __toCommonJS(matter_physics_methods_exports)).setCollidesWith,
      setOnCollide: (init_matter_physics_methods(), __toCommonJS(matter_physics_methods_exports)).setOnCollide,
      setOnCollideEnd: (init_matter_physics_methods(), __toCommonJS(matter_physics_methods_exports)).setOnCollideEnd,
      setOnCollideActive: (init_matter_physics_methods(), __toCommonJS(matter_physics_methods_exports)).setOnCollideActive,
      setOnCollideWith: (init_matter_physics_methods(), __toCommonJS(matter_physics_methods_exports)).setOnCollideWith,
      drawDebug: (init_debug(), __toCommonJS(debug_exports)).drawDebug,
      destroy: (init_destroy2(), __toCommonJS(destroy_exports2)).destroy
    };
  }
});

// node_modules/phaser-raycaster/src/raycaster-core.js
var raycaster_core_exports = {};
__export(raycaster_core_exports, {
  Raycaster: () => Raycaster
});
function Raycaster(options) {
  this.version = "0.11.0";
  this.scene;
  this.graphics;
  this.debugOptions = {
    enabled: false,
    maps: true,
    rays: true,
    graphics: {
      ray: 65280,
      rayPoint: 16711935,
      mapPoint: 65535,
      mapSegment: 255,
      mapBoundingBox: 16711680
    }
  };
  this._stats = {
    mappedObjects: {
      total: 0,
      static: 0,
      dynamic: 0,
      rectangleMaps: 0,
      polygonMaps: 0,
      circleMaps: 0,
      lineMaps: 0,
      containerMaps: 0,
      tilemapMaps: 0,
      matterMaps: 0
    }
  };
  this.boundingBox = false;
  this.mappedObjects = [];
  this.dynamicMappedObjects = [];
  this.mapSegmentCount = 0;
  if (options !== void 0) {
    if (options.boundingBox === void 0 && options.scene !== void 0) {
      if (options.scene.physics !== void 0)
        options.boundingBox = options.scene.physics.world.bounds;
      else if (options.scene.matter !== void 0) {
        let walls = options.scene.matter.world.walls;
        if (walls.top !== null) {
          options.boundingBox = new import_phaser21.Geom.Rectangle(
            walls.top.vertices[3].x,
            walls.top.vertices[3].y,
            walls.bottom.vertices[1].x - walls.top.vertices[3].x,
            walls.bottom.vertices[1].y - walls.top.vertices[3].y
          );
        }
      }
    }
    this.setOptions(options);
    if (options.autoUpdate === void 0 || options.autoUpdate)
      this.scene.events.on("update", this.update, this);
  } else
    this.scene.events.on("update", this.update, this);
  return this;
}
var import_phaser21;
var init_raycaster_core = __esm({
  "node_modules/phaser-raycaster/src/raycaster-core.js"() {
    import_phaser21 = __toESM(require_phaser());
    Raycaster.prototype = {
      /**
      * Configure raycaster.
      *
      * @method Raycaster#setOptions
      * @memberof Raycaster
      * @instance
      * @since 0.6.0
      *
      * @param {object} [options] - Raycaster's congfiguration options. May include:
      * @param {Phaser.Scene} [options.scene] - Scene in which Raycaster will be used.
      * @param {number} [options.mapSegmentCount = 0] - Number of segments of circle maps.
      * @param {(object|object[])} [options.objects] - Game object or array of game objects to map.
      * @param {Phaser.Geom.Rectangle} [options.boundingBox] - Raycaster's bounding box.
      * @param {boolean|object} [options.debug] - Enable debug mode or cofigure {@link Raycaster#debugOptions debugOptions}.
      *
      * @return {Raycaster} {@link Raycaster Raycaster} instance
      */
      setOptions: function(options) {
        if (options.scene !== void 0) {
          this.scene = options.scene;
          this.graphics = this.scene.add.graphics({ lineStyle: { width: 1, color: 65280 }, fillStyle: { color: 16711935 } });
          this.graphics.setDepth(999);
        }
        if (options.debug !== void 0 && options.debug !== false) {
          this.debugOptions.enabled = true;
          if (typeof options.debug === "object")
            Object.assign(this.debugOptions, options.debug);
        }
        if (options.mapSegmentCount !== void 0)
          this.mapSegmentCount = options.mapSegmentCount;
        if (options.objects !== void 0)
          this.mapGameObjects(options.objects);
        if (options.boundingBox !== void 0)
          this.setBoundingBox(options.boundingBox.x, options.boundingBox.y, options.boundingBox.width, options.boundingBox.height);
        return this;
      },
      /**
      * Set Raycaster's bounding box.
      *
      * @method Raycaster#setBoundingBox
      * @memberof Raycaster
      * @instance
      * @since 0.6.0
      *
      * @param {number} x - The X coordinate of the top left corner of bounding box.
      * @param {number} y - The Y coordinate of the top left corner of bounding box.
      * @param {number} width - The width of bounding box.
      * @param {number} height - The height of bounding box.
      *
      * @return {Raycaster} {@link Raycaster Raycaster} instance
      */
      setBoundingBox: function(x, y, width, height) {
        this.boundingBox = {
          rectangle: new import_phaser21.Geom.Rectangle(x, y, width, height),
          points: [],
          segments: []
        };
        let points = [
          new import_phaser21.Math.Vector2(this.boundingBox.rectangle.left, this.boundingBox.rectangle.top),
          new import_phaser21.Math.Vector2(this.boundingBox.rectangle.right, this.boundingBox.rectangle.top),
          new import_phaser21.Math.Vector2(this.boundingBox.rectangle.right, this.boundingBox.rectangle.bottom),
          new import_phaser21.Math.Vector2(this.boundingBox.rectangle.left, this.boundingBox.rectangle.bottom)
        ];
        this.boundingBox.points = points;
        for (let i = 0, length = this.boundingBox.points.length; i < length; i++) {
          if (i + 1 < length)
            this.boundingBox.segments.push(new import_phaser21.Geom.Line(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y));
          else
            this.boundingBox.segments.push(new import_phaser21.Geom.Line(points[i].x, points[i].y, points[0].x, points[0].y));
        }
      },
      /**
      * Map game objects
      *
      * @method Raycaster#mapGameObjects
      * @memberof Raycaster
      * @instance
      * @since 0.6.0
      *
      * @param {object|object[]} objects - Game object / matter body or array of game objects / matter bodies to map.
      * @param {boolean} [dynamic = false] - {@link Raycaster.Map Raycaster.Map} dynamic flag (determines map will be updated automatically).
      * @param {object} [options] - Additional options for {@link Raycaster.Map Raycaster.Map}
      *
      * @return {Raycaster} {@link Raycaster Raycaster} instance
      */
      mapGameObjects: function(objects, dynamic = false, options = {}) {
        options.dynamic = dynamic;
        options.segmentCount = options.segmentCount !== void 0 ? options.segmentCount : this.segmentCount;
        if (!Array.isArray(objects))
          objects = [objects];
        for (let object of objects) {
          if (this.mappedObjects.includes(object))
            continue;
          if (object.data && object.data.get("raycasterMapNotSupported"))
            continue;
          let config3 = {};
          for (let option in options) {
            config3[option] = options[option];
          }
          config3.object = object;
          let map = new this.Map(config3, this);
          if (map.notSupported) {
            map.destroy();
            continue;
          }
          if (object.type === "body" || object.type === "composite") {
            object.raycasterMap = map;
          } else if (!object.data) {
            object.setDataEnabled();
            object.data.set("raycasterMap", map);
          } else {
            object.data.set("raycasterMap", map);
          }
          this.mappedObjects.push(object);
          switch (object.type) {
            case "Polygon":
              this._stats.mappedObjects.polygonMaps++;
              break;
            case "Arc":
              this._stats.mappedObjects.circleMaps++;
              break;
            case "Line":
              this._stats.mappedObjects.lineMaps++;
              break;
            case "Container":
              this._stats.mappedObjects.containerMaps++;
              break;
            case "StaticTilemapLayer":
              this._stats.mappedObjects.tilemapMaps++;
              break;
            case "DynamicTilemapLayer":
              this._stats.mappedObjects.tilemapMaps++;
              break;
            case "TilemapLayer":
              this._stats.mappedObjects.tilemapMaps++;
              break;
            case "MatterBody":
              this._stats.mappedObjects.matterMaps++;
              break;
            default:
              this._stats.mappedObjects.rectangleMaps++;
          }
        }
        this._stats.mappedObjects.total = this.mappedObjects.length;
        this._stats.mappedObjects.static = this._stats.mappedObjects.total - this.dynamicMappedObjects.length;
        return this;
      },
      /**
      * Remove game object's {@link Raycaster.Map Raycaster.Map} maps.
      *
      * @method Raycaster#removeMappedObjects
      * @memberof Raycaster
      * @instance
      * @since 0.6.0
      *
      * @param {(object|object[])} objects - Game object or array of game objects which maps will be removed.
      *
      * @return {Raycaster} {@link Raycaster Raycaster} instance
      */
      removeMappedObjects: function(objects) {
        if (!Array.isArray(objects))
          objects = [objects];
        for (let object of objects) {
          let index = this.mappedObjects.indexOf(object);
          if (index === -1) {
            continue;
          }
          this.mappedObjects.splice(index, 1);
          index = this.dynamicMappedObjects.indexOf(object);
          if (index >= 0)
            this.dynamicMappedObjects.splice(index, 1);
          if (object.type === "body" || object.type === "composite") {
            object.raycasterMap.destroy();
          } else {
            object.data.get("raycasterMap").destroy();
          }
          switch (object.type) {
            case "Polygon":
              this._stats.mappedObjects.polygonMaps--;
              break;
            case "Arc":
              this._stats.mappedObjects.circleMaps--;
              break;
            case "Line":
              this._stats.mappedObjects.lineMaps--;
              break;
            case "Container":
              this._stats.mappedObjects.containerMaps--;
              break;
            case "StaticTilemapLayer":
              this._stats.mappedObjects.tilemapMaps--;
              break;
            case "DynamicTilemapLayer":
              this._stats.mappedObjects.tilemapMaps--;
              break;
            case "TilemapLayer":
              this._stats.mappedObjects.tilemapMaps--;
              break;
            case "MatterBody":
              this._stats.mappedObjects.matterMaps--;
              break;
            default:
              this._stats.mappedObjects.rectangleMaps--;
          }
        }
        this._stats.mappedObjects.total = this.mappedObjects.length;
        this._stats.mappedObjects.dynamic = this.dynamicMappedObjects.length;
        this._stats.mappedObjects.static = this._stats.mappedObjects.total - this.dynamicMappedObjects.length;
        return this;
      },
      /**
      * Enable game object's {@link Raycaster.Map Raycaster.Map} maps.
      *
      * @method Raycaster#enableMaps
      * @memberof Raycaster
      * @instance
      * @since 0.7.2
      *
      * @param {(object|object[])} objects - Game object or array of game objects which maps will be enabled.
      *
      * @return {Raycaster} {@link Raycaster Raycaster} instance
      */
      enableMaps: function(objects) {
        if (!Array.isArray(objects))
          objects = [objects];
        for (let object of objects) {
          let map;
          if (object.type === "body" || object.type === "composite") {
            map = object.raycasterMap;
          } else if (object.data) {
            map = object.data.get("raycasterMap");
          }
          if (map)
            map.active = true;
        }
        return this;
      },
      /**
      * Disable game object's {@link Raycaster.Map Raycaster.Map} maps.
      *
      * @method Raycaster#disableMaps
      * @memberof Raycaster
      * @instance
      * @since 0.7.2
      *
      * @param {(object|object[])} objects - Game object or array of game objects which maps will be disabled.
      *
      * @return {Raycaster} {@link Raycaster Raycaster} instance
      */
      disableMaps: function(objects) {
        if (!Array.isArray(objects))
          objects = [objects];
        for (let object of objects) {
          let map;
          if (object.type === "body" || object.type === "composite") {
            map = object.raycasterMap;
          } else if (object.data) {
            map = object.data.get("raycasterMap");
          }
          if (map)
            map.active = false;
        }
        return this;
      },
      /**
      * Updates all {@link Raycaster.Map Raycaster.Map} dynamic maps. Fired on Phaser.Scene update event.
      *
      * @method Raycaster#update
      * @memberof Raycaster
      * @instance
      * @since 0.6.0
      * 
      * @return {Raycaster} {@link Raycaster Raycaster} instance
      */
      update: function() {
        if (this.dynamicMappedObjects.length > 0) {
          for (let mapppedObject of this.dynamicMappedObjects) {
            let map;
            if (mapppedObject.type === "body" || mapppedObject.type === "composite") {
              map = mapppedObject.raycasterMap;
            } else if (mapppedObject.data) {
              map = mapppedObject.data.get("raycasterMap");
            }
            if (!map)
              continue;
            if (map.active) {
              map.updateMap();
            }
          }
        }
        if (this.debugOptions.enabled)
          this.drawDebug();
        return this;
      },
      /**
      * Create {@link Raycaster.Ray Raycaster.Ray} object.
      *
      * @method Raycaster#createRay
      * @memberof Raycaster
      * @instance
      * @since 0.6.0
      *
      * @param {object} [options] - Ray's congfiguration options. May include:
      * @param {Phaser.Math.Vector2|Point} [options.origin = {x:0, y:0}] - Ray's position.
      * @param {number} [options.angle = 0] - Ray's angle in radians.
      * @param {number} [options.angleDeg = 0] - Ray's angle in degrees.
      * @param {number} [options.cone = 0] - Ray's cone angle in radians.
      * @param {number} [options.coneDeg = 0] - Ray's cone angle in degrees.
      * @param {number} [options.range = Phaser.Math.MAX_SAFE_INTEGER] - Ray's range.
      * @param {number} [options.collisionRange = Phaser.Math.MAX_SAFE_INTEGER] - Ray's maximum collision range of ray's field of view.
      * @param {number} [options.detectionRange = Phaser.Math.MAX_SAFE_INTEGER] - Maximum distance between ray's position and tested objects bounding boxes.
      * @param {boolean} [options.ignoreNotIntersectedRays = true] - If set true, ray returns false when it didn't hit anything. Otherwise returns ray's target position.
      * @param {boolean} [options.autoSlice = false] - If set true, ray will automatically slice intersections into array of triangles and store it in {@link Raycaster.Ray#slicedIntersections Ray.slicedIntersections}.
      * @param {boolean} [options.round = false] - If set true, point where ray hit will be rounded.
      * @param {(boolean|'arcade'|'matter')} [options.enablePhysics = false] - Add to ray physics body. Body will be a circle with radius equal to {@link Raycaster.Ray#collisionRange Ray.collisionRange}. If set true, arcade physics body will be added.
      *
      * @return {Raycaster.Ray} {@link Raycaster.Ray Raycaster.Ray} instance
      */
      createRay: function(options = {}) {
        return new this.Ray(options, this);
      },
      /**
      * Get raycaster statistics.
      *
      * @method Raycaster#getStats
      * @memberof Raycaster
      * @instance
      * @since 0.10.0
      *
      * @return {object} Raycaster statistics.
      */
      getStats: function() {
        return this._stats;
      },
      /**
      * Draw maps in debug mode
      *
      * @method Raycaster#drawDebug
      * @memberof Raycaster
      * @private
      * @since 0.10.0
      * 
      * @return {Raycaster} {@link Raycaster Raycaster} instance
      */
      drawDebug: function() {
        if (this.graphics === void 0 || !this.debugOptions.enabled)
          return this;
        this.graphics.clear();
        if (!this.debugOptions.maps)
          return this;
        for (let object of this.mappedObjects) {
          let map;
          if (object.type === "body" || object.type === "composite")
            map = object.raycasterMap;
          else if (object.data)
            map = object.data.get("raycasterMap");
          if (!map)
            continue;
          if (this.debugOptions.graphics.mapBoundingBox) {
            this.graphics.lineStyle(1, this.debugOptions.graphics.mapBoundingBox);
            this.graphics.strokeRectShape(map.getBoundingBox());
          }
          if (this.debugOptions.graphics.mapSegment) {
            this.graphics.lineStyle(1, this.debugOptions.graphics.mapSegment);
            for (let segment of map.getSegments()) {
              this.graphics.strokeLineShape(segment);
            }
          }
          if (this.debugOptions.graphics.mapPoint) {
            this.graphics.fillStyle(this.debugOptions.graphics.mapPoint);
            for (let point of map.getPoints()) {
              this.graphics.fillPoint(point.x, point.y, 3);
            }
          }
        }
        return this;
      },
      /**
       * Destroy object and all mapped objects.
       *
       * @method Raycaster#destroy
       * @memberof Raycaster
       * @instance
       * @since 0.10.3
       */
      destroy: function() {
        this.removeMappedObjects(this.mappedObjects);
        if (this.graphics)
          this.graphics.destroy();
        if (this.scene) {
          this.scene.events.removeListener("update", null, this);
        }
        for (let key in this) {
          delete this[key];
        }
      }
    };
    Raycaster.prototype.Map = (init_map_core(), __toCommonJS(map_core_exports)).Map;
    Raycaster.prototype.Ray = (init_ray_core(), __toCommonJS(ray_core_exports)).Ray;
  }
});

// node_modules/phaser-raycaster/src/main.js
var main_exports = {};
__export(main_exports, {
  default: () => PhaserRaycaster
});
var import_phaser22, ScenePlugin, PhaserRaycaster;
var init_main = __esm({
  "node_modules/phaser-raycaster/src/main.js"() {
    import_phaser22 = __toESM(require_phaser());
    ScenePlugin = import_phaser22.Plugins.ScenePlugin;
    PhaserRaycaster = class extends ScenePlugin {
      constructor(scene, pluginManager) {
        super(scene, pluginManager);
        this._Raycaster = (init_raycaster_core(), __toCommonJS(raycaster_core_exports)).Raycaster;
      }
      /**
      * Create Raycaster object.
      *
      * @method PhaserRaycaster#createRaycaster
      * @memberof PhaserRaycaster
      * @instance
      * @since 0.6.0
      *
      * @param {object} [options] - Raycaster's congfiguration options. May include:
      * @param {number} [options.mapSegmentCount = 0] - Number of segments of circle maps. If set to 0, map will be teste
      * @param {(object|object[])} [options.objects] - Game object or array of game objects to map.
      * @param {Phaser.Geom.Rectangle} [options.boundingBox] - Raycaster's bounding box. If not passed, {@link Raycaster Raycaster} will set it's bounding box based on Arcade Physics / Matter physics world bounds.
      * @param {boolean} [options.autoUpdate = true] - If set true, automatically update dynamic maps on scene update event.
      * @param {boolean|object} [options.debug] - Enable debug mode or configure it {@link Raycaster#debugOptions debugOptions}.
      *
      * @return {Raycaster} {@link Raycaster Raycaster} instance
      */
      createRaycaster(options = {}) {
        options.scene = this.scene;
        return new this._Raycaster(options);
      }
    };
  }
});

// node_modules/phaser-raycaster/src/main-esm.js
var main_esm_default = (init_main(), __toCommonJS(main_exports)).default;
var PhaserRaycaster2 = (init_main(), __toCommonJS(main_exports)).default;
var Raycaster2 = (init_raycaster_core(), __toCommonJS(raycaster_core_exports)).Raycaster;
export {
  PhaserRaycaster2 as PhaserRaycaster,
  Raycaster2 as Raycaster,
  main_esm_default as default
};
/*! Bundled license information:

phaser-raycaster/src/raycaster-core.js:
phaser-raycaster/src/main.js:
phaser-raycaster/src/main-esm.js:
  (**
  * @author       Marcin Walczak <contact@marcin-walczak.pl>
  * @copyright    2026 Marcin Walczak
  * @license      {@link https://github.com/wiserim/phaser-raycaster/blob/master/LICENSE|MIT License}
  *)
*/
//# sourceMappingURL=phaser-raycaster.js.map
