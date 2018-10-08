"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var more_1 = require("./more");
var csg_js_1 = require("./../csg.js");
var viewer_js_1 = require("./viewer.js");
var box = {
    outline: {
        width: 81,
        depth: 79,
        height: 40
    },
    internal: {
        width: 81 + 10,
        depth: 79 + 10,
        height: 40
    },
    thickness: {
        body: {
            wall: 2,
            base: 2
        },
        lid: {
            outer: 2
        }
    },
    other: {
        corner_radius: 10,
        catch: {
            height: 5,
            width: 20,
            depth: 5
        }
    },
    mount: {
        radius: 4,
        height: 6,
        hole: {
            height: 3
        },
        locations: [
            {
                y: 24,
                x: -5
            },
            {
                x: -5,
                y: 60
            },
            {
                x: 31,
                y: 25
            },
            {
                x: 7.5,
                y: 60
            }
        ]
    }
};
function box_contour(width, height, radius) {
    var hc = height - 2 * radius;
    var wc = width - 2 * radius;
    var pl = new more_1.Line(width / 2, 0).line(0, hc / 2).arc({ rx: radius }).line(-wc, 0).arc({ rx: radius, start: Math.PI / 2 }).line(0, -hc).arc({ rx: radius, start: Math.PI }).line(wc, 0).arc({ rx: radius, start: Math.PI * 1.5 });
    return pl.toPolygon();
}
function box_contour3(width, height, radius) {
    var hc = height - 2 * radius;
    var wc = width - 2 * radius;
    var pl = new more_1.Line(width / 2, 0).line(0, hc / 2).line(-radius, radius).line(-wc, 0).line(-radius, -radius).line(0, -hc).line(radius, -radius).line(wc, 0).line(radius, radius);
    return pl.toPolygon();
}
function add_mounts(body) {
    var md = box.mount;
    var i = box.internal;
    var m = new more_1.Line(md.radius, 0).arc({ rx: md.radius, arc: 2 * Math.PI, slices: 24 }).toPolygon();
    var mc = more_1.extrude(m, [0, 0, md.height]);
    md.locations.forEach(function (l) {
        var c = mc.clone();
        more_1.translate(c, [(l.x > 0 ? -1 : 1) * i.width / 2 + l.x, (l.y > 0 ? -1 : 1) * i.height / 2 + l.y, 0]);
        body = body.union(c);
    });
    return body;
}
function outline() {
    var i = box.outline;
    var poly = new more_1.Line(i.width / 2, 0).line(0, i.depth / 2).line(-i.width, 0).line(0, -i.depth).line(i.width, 0).line(0, i.depth / 2).toPolygon({ z: 10 });
    return csg_js_1.CSG.fromPolygons([poly]);
}
function body() {
    var i = box.internal;
    var tb = box.thickness.body;
    var tl = box.thickness.lid;
    var cr = box.other.corner_radius;
    var outer = more_1.extrude(box_contour(i.width, i.depth, cr), [0, 0, i.height]);
    var inner = more_1.extrude(box_contour(i.width - tb.wall * 2, i.depth - tb.wall * 2, cr - tb.wall / 2), [0, 0, i.height - tb.base]);
    more_1.translate(inner, [0, 0, tb.base]);
    var shell = outer.subtract(inner);
    // cut out lid slot
    var lid_outer = more_1.extrude(box_contour(i.width - tb.wall, i.depth - tb.wall, cr), [0, 0, tl.outer]);
    more_1.translate(lid_outer, [0, 0, i.height - tl.outer / 2]);
    shell = shell.subtract(lid_outer);
    // add lid catch
    var lc = box.other.catch;
    var cat = new more_1.Line(0, 0).line(0, lc.height).line(-lc.depth, 0).line(0, -lc.height).translate(i.width / 2, i.height - 0.5).toPolygon({ y: -lc.width / 2 });
    lc = more_1.extrude(cat, [0, lc.width, 0]);
    // add lid hook
    // var hook = new Line(0, 0).line(0, 1).line(-lc.depth, 0).line(0, -lc.height).close().translate(i.width / 2, i.height - 0.5).toPolygon({ y: -lc.width / 2 })
    // lc = extrude({ polygon: cat, d: [0, lc.width, 0] })
    shell = shell.union(lc);
    // mounts
    shell = add_mounts(shell);
    return shell;
}
viewer_js_1.addViewer(new viewer_js_1.Viewer([body(),], 500, 500, 500));
//# sourceMappingURL=main.js.map