import Viewer = require('./viewer.js')
import CSG = require('./csg.js')

import GL = require('./lightgl.js')

declare global {
  interface Array<T> {
    get(i: number): T
  }
}
Array.prototype.get = function (i) {
  if (i < 0)
    return this[this.length + i];
  if (i >= this.length)
    return this[i - this.length];
  return this[i];
}

export function download(data, filename, type) {
  var file = new Blob([data], { type: type });
  if (window.navigator.msSaveOrOpenBlob) // IE10+
    window.navigator.msSaveOrOpenBlob(file, filename);
  else { // Others
    var a = document.createElement("a"),
      url = URL.createObjectURL(file);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 0);
  }
}
const hint = 0.00001

function poly(...pts) {
  if (pts[0] instanceof Array)
    pts = pts.map(e => new CSG.Vector(e));
  var n = faceNormal(pts, 0);
  if (isNaN(n.x)) {
    console.log(pts);
    throw "bad face normal"
  }

  return new CSG.Polygon(pts.map(p => new CSG.Vertex(p, n)));
}

function faceNormal(vs, idx) {
  var v1 = vs[1 + idx].minus(vs[0])
  var v2 = vs[2 + idx].minus(vs[0])
  return v1.cross(v2).unit()
}

function annulus({ height, outer, inner, slices = 16 }) {
  var oc = CSG.cylinder({
    start: [0, 0, -height / 2],
    end: [0, 0, height / 2],
    radius: outer,
    slices: (slices * outer / inner) | 0
  });
  var ic = CSG.cylinder({
    start: [0, 0, -height / 2 - hint],
    end: [0, 0, height / 2 + hint],
    radius: inner,
    slices: slices
  });
  return oc.subtract(ic)
}

function slot({ height, length, head, shaft, slices = 16 }) {
  var lc = CSG.cylinder({
    start: [-length / 2, 0, -height / 2],
    end: [-length / 2, 0, height / 2],
    radius: shaft,
    slices: slices
  });
  var bc = CSG.cylinder({
    start: [length / 2, 0, -height / 2],
    end: [length / 2, 0, height / 2],
    radius: head,
    slices: slices
  });
  var box = CSG.cube({ radius: [length / 2 + hint, shaft, height / 2] })
  return lc.union(bc).union(box);
}
function rect({ x, y, z = 0 }) {
  return poly([x / 2, y / 2, z], [-x / 2, y / 2])
}
function hexagon({ r, z = 0 }) {
  const H = Math.sin(Math.PI * 60 / 180) * r;
  const W = Math.cos(Math.PI * 60 / 180) * r;
  return poly([r, 0, z], [W, H, z], [-W, H, z], [-r, 0, z], [-W, -H, z], [W, -H, z], [r, 0, z])
}

export function extrude(polygon:CSG.Polygon, d:Point3D|CSG.Vector) {
  if (d instanceof Array)
    d = new CSG.Vector(d)
  return prism([polygon, polygon.clone().translate(d)])
}

export function prism(polygons:CSG.Polygon[]) {
  var idx = 0
  var first = polygons[idx++];
  var ps = [first]
  while (true) {
    var last = polygons[idx++];
    if (!last) break;
    var d = last.vertices[0].pos.minus(first.vertices[0].pos);
    if (first.plane.normal.dot(d) > 0)
      first.flip();
    if (last.plane.normal.dot(d) < 0)
      last.flip();
    var l = first.vertices.length - 1
    for (var i = 0; i <= l; i++) {
      ps.push(poly(first.vertices[i].pos, last.vertices[l - i].pos, last.vertices.get(l - i - 1).pos, first.vertices.get(i + 1).pos, first.vertices[i].pos))
    }
    first = last;
  }
  ps.push(first)
  return CSG.fromPolygons(ps)
}

// function triangle({ r, z = 0 }) {
//   return poly([0, 0, -l], [0, r, -l], [r, 0, -l][0, 0, -l])
// }
export function translate(c:CSG.Polygon, v:number[]|CSG.Vector) {
  if (v instanceof Array)
    v = new CSG.Vector(v)
  c.polygons.forEach(e => {
    e.vertices.forEach(ev => ev.pos = ev.pos.plus(v));
    e.plane.w = e.plane.normal.dot(e.vertices[0]);
  })
}
export function rotate(c:CSG.Polygon, a:number, v:CSG.Vector) {
  var m = GL.Matrix.rotate(a, v.x, v.y, v.z)
  var p = []
  c.polygons.forEach(e => {
    p.push(new CSG.Polygon(e.vertices.map(ev => ev.rotate(m))));
  })
  return CSG.fromPolygons(p);
}
interface ArcParams {
  rx: number
  ry?: number
  arc?: number
  arcd?: number
  start?: number
  slices?: number
}
type Point2D = [number, number]
type Point3D = [number, number,number]
export class Line {

  private loc: Point2D
  private points: Point2D[]
  constructor(x?: number, y?: number) {
    if (x !== undefined) {
      this.loc = [x, y];
      this.points = [this.loc]
    }
  }
  clone() {
    var l2 = new Line();
    l2.points = []
    this.points.forEach(p => l2.points.push([p[0], p[1]]));
    l2.locToLast();
    return l2;
  }
  moveTo(x, y) {
    this.loc = [x, y]
    return this;
  }
  lineTo(x, y) {
    this.points.push(this.loc = [x, y])
    return this;
  }
  line(x, y) {
    this.points.push([this.loc[0] + x, this.loc[1] + y])
    this.locToLast()
    return this;
  }
  locToLast() {
    this.loc = this.points[this.points.length - 1]
  }
  move(x, y) {
    this.loc = [this.loc[0] + x, this.loc[1] + y]
    return this;
  }
  translate(x, y) {
    this.points.forEach(v => {
      v[0] += x;
      v[1] += y;
    });
    this.locToLast();
    return this;
  }

  arc({ rx, ry = rx, start = 0, arc = Math.PI / 2, slices = 4, arcd }: ArcParams) {
    if (arcd !== undefined)
      arc = arcd / 180 * Math.PI
    var end = start + arc;
    this.move(-rx * Math.cos(start), -ry * Math.sin(start))
    for (var i = 1; i <= slices; i++) {
      var a = start + arc / slices * i;
      this.points.push([this.loc[0] + rx * Math.cos(a), this.loc[1] + ry * Math.sin(a)])
    }
    this.locToLast()
    return this;
  }
  static rect(x: number, y: number = x) {
    return new Line(x, 0).line(0, y).line(-2*x, 0).line(0, -2*y).line(2*x, 0);
  }
  static circle(rx: number, ry: number = rx, slices: number = 12) {
    return new Line(rx, 0).arc({ rx: rx, ry: ry, arcd: 360, slices: slices });
  }

  shrink(ofs) {

    var sofs = Math.sqrt(ofs);
    var r = new Line();
    r.points = [];
    for (var i = 0; i < this.points.length; i++) {
      var v0 = new CSG.Vector(this.points.get(i)[0], this.points.get(i)[1], 0);
      var v1 = new CSG.Vector(this.points.get(i - 1)[0], this.points.get(i - 1)[1], 0);
      var v2 = new CSG.Vector(this.points.get(i + 1)[0], this.points.get(i + 1)[1], 0);
      var v10 = v1.minus(v0).unit();
      var v20 = v2.minus(v0).unit();
      var ov = v20.plus(v10).unit().times(sofs).plus(v0);
      r.points.push([ov.x, ov.y])
    }
    r.locToLast();
    return r;
  }

  scale(x, y) {
    y = y || x
    this.points.forEach(v => {
      v[0] *= x;
      v[1] *= y;
    });
    this.locToLast();
    return this;
  }

  toPolygon({ z = null, x = null, y = null } = { z: 0 }) {
    var m;
    if (z != null) m = a => [a[0], a[1], z]
    else if (x != null) m = a => [x, a[0], a[1]]
    else if (y != null) m = a => [a[0], y, a[1]]
    else throw "no plane"
    var zs = this.points.map(p => m(p));
    return poly(...zs);
  }
}
