"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var CSG = require("./csg.js");
var GL = require("./lightgl.js");
Array.prototype.get = function (i) {
    if (i < 0)
        return this[this.length + i];
    if (i >= this.length)
        return this[i - this.length];
    return this[i];
};
function download(data, filename, type) {
    var file = new Blob([data], { type: type });
    if (window.navigator.msSaveOrOpenBlob) // IE10+
        window.navigator.msSaveOrOpenBlob(file, filename);
    else { // Others
        var a = document.createElement("a"), url = URL.createObjectURL(file);
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
exports.download = download;
var hint = 0.00001;
function poly() {
    var pts = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        pts[_i] = arguments[_i];
    }
    if (pts[0] instanceof Array)
        pts = pts.map(function (e) { return new CSG.Vector(e); });
    var n = faceNormal(pts, 0);
    if (isNaN(n.x)) {
        console.log(pts);
        throw "bad face normal";
    }
    return new CSG.Polygon(pts.map(function (p) { return new CSG.Vertex(p, n); }));
}
function faceNormal(vs, idx) {
    var v1 = vs[1 + idx].minus(vs[0]);
    var v2 = vs[2 + idx].minus(vs[0]);
    return v1.cross(v2).unit();
}
function annulus(_a) {
    var height = _a.height, outer = _a.outer, inner = _a.inner, _b = _a.slices, slices = _b === void 0 ? 16 : _b;
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
    return oc.subtract(ic);
}
function slot(_a) {
    var height = _a.height, length = _a.length, head = _a.head, shaft = _a.shaft, _b = _a.slices, slices = _b === void 0 ? 16 : _b;
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
    var box = CSG.cube({ radius: [length / 2 + hint, shaft, height / 2] });
    return lc.union(bc).union(box);
}
function rect(_a) {
    var x = _a.x, y = _a.y, _b = _a.z, z = _b === void 0 ? 0 : _b;
    return poly([x / 2, y / 2, z], [-x / 2, y / 2]);
}
function hexagon(_a) {
    var r = _a.r, _b = _a.z, z = _b === void 0 ? 0 : _b;
    var H = Math.sin(Math.PI * 60 / 180) * r;
    var W = Math.cos(Math.PI * 60 / 180) * r;
    return poly([r, 0, z], [W, H, z], [-W, H, z], [-r, 0, z], [-W, -H, z], [W, -H, z], [r, 0, z]);
}
function extrude(polygon, d) {
    if (d instanceof Array)
        d = new CSG.Vector(d);
    return prism([polygon, polygon.clone().translate(d)]);
}
exports.extrude = extrude;
function prism(polygons) {
    var idx = 0;
    var first = polygons[idx++];
    var ps = [first];
    while (true) {
        var last = polygons[idx++];
        if (!last)
            break;
        var d = last.vertices[0].pos.minus(first.vertices[0].pos);
        if (first.plane.normal.dot(d) > 0)
            first.flip();
        if (last.plane.normal.dot(d) < 0)
            last.flip();
        var l = first.vertices.length - 1;
        for (var i = 0; i <= l; i++) {
            ps.push(poly(first.vertices[i].pos, last.vertices[l - i].pos, last.vertices.get(l - i - 1).pos, first.vertices.get(i + 1).pos, first.vertices[i].pos));
        }
        first = last;
    }
    ps.push(first);
    return CSG.fromPolygons(ps);
}
exports.prism = prism;
// function triangle({ r, z = 0 }) {
//   return poly([0, 0, -l], [0, r, -l], [r, 0, -l][0, 0, -l])
// }
function translate(c, v) {
    if (v instanceof Array)
        v = new CSG.Vector(v);
    c.polygons.forEach(function (e) {
        e.vertices.forEach(function (ev) { return ev.pos = ev.pos.plus(v); });
        e.plane.w = e.plane.normal.dot(e.vertices[0]);
    });
}
exports.translate = translate;
function rotate(c, a, v) {
    var m = GL.Matrix.rotate(a, v.x, v.y, v.z);
    var p = [];
    c.polygons.forEach(function (e) {
        p.push(new CSG.Polygon(e.vertices.map(function (ev) { return ev.rotate(m); })));
    });
    return CSG.fromPolygons(p);
}
exports.rotate = rotate;
var Line = /** @class */ (function () {
    function Line(x, y) {
        if (x !== undefined) {
            this.loc = [x, y];
            this.points = [this.loc];
        }
    }
    Line.prototype.clone = function () {
        var l2 = new Line();
        l2.points = [];
        this.points.forEach(function (p) { return l2.points.push([p[0], p[1]]); });
        l2.locToLast();
        return l2;
    };
    Line.prototype.moveTo = function (x, y) {
        this.loc = [x, y];
        return this;
    };
    Line.prototype.lineTo = function (x, y) {
        this.points.push(this.loc = [x, y]);
        return this;
    };
    Line.prototype.line = function (x, y) {
        this.points.push([this.loc[0] + x, this.loc[1] + y]);
        this.locToLast();
        return this;
    };
    Line.prototype.locToLast = function () {
        this.loc = this.points[this.points.length - 1];
    };
    Line.prototype.move = function (x, y) {
        this.loc = [this.loc[0] + x, this.loc[1] + y];
        return this;
    };
    Line.prototype.translate = function (x, y) {
        this.points.forEach(function (v) {
            v[0] += x;
            v[1] += y;
        });
        this.locToLast();
        return this;
    };
    Line.prototype.arc = function (_a) {
        var rx = _a.rx, _b = _a.ry, ry = _b === void 0 ? rx : _b, _c = _a.start, start = _c === void 0 ? 0 : _c, _d = _a.arc, arc = _d === void 0 ? Math.PI / 2 : _d, _e = _a.slices, slices = _e === void 0 ? 4 : _e, arcd = _a.arcd;
        if (arcd !== undefined)
            arc = arcd / 180 * Math.PI;
        var end = start + arc;
        this.move(-rx * Math.cos(start), -ry * Math.sin(start));
        for (var i = 1; i <= slices; i++) {
            var a = start + arc / slices * i;
            this.points.push([this.loc[0] + rx * Math.cos(a), this.loc[1] + ry * Math.sin(a)]);
        }
        this.locToLast();
        return this;
    };
    Line.rect = function (x, y) {
        if (y === void 0) { y = x; }
        return new Line(x, 0).line(0, y).line(-2 * x, 0).line(0, -2 * y).line(2 * x, 0);
    };
    Line.circle = function (rx, ry, slices) {
        if (ry === void 0) { ry = rx; }
        if (slices === void 0) { slices = 12; }
        return new Line(rx, 0).arc({ rx: rx, ry: ry, arcd: 360, slices: slices });
    };
    Line.prototype.shrink = function (ofs) {
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
            r.points.push([ov.x, ov.y]);
        }
        r.locToLast();
        return r;
    };
    Line.prototype.scale = function (x, y) {
        y = y || x;
        this.points.forEach(function (v) {
            v[0] *= x;
            v[1] *= y;
        });
        this.locToLast();
        return this;
    };
    Line.prototype.toPolygon = function (_a) {
        var _b = _a === void 0 ? { z: 0 } : _a, _c = _b.z, z = _c === void 0 ? null : _c, _d = _b.x, x = _d === void 0 ? null : _d, _e = _b.y, y = _e === void 0 ? null : _e;
        var m;
        if (z != null)
            m = function (a) { return [a[0], a[1], z]; };
        else if (x != null)
            m = function (a) { return [x, a[0], a[1]]; };
        else if (y != null)
            m = function (a) { return [a[0], y, a[1]]; };
        else
            throw "no plane";
        var zs = this.points.map(function (p) { return m(p); });
        return poly.apply(void 0, zs);
    };
    return Line;
}());
exports.Line = Line;
//# sourceMappingURL=more.js.map