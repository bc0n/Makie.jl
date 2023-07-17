import * as Camera from "./Camera.js";
import * as THREE from "https://cdn.esm.sh/v66/three@0.136/es2021/three.js";

const LINES_VERT = `#version 300 es
precision mediump int;
precision highp float;
precision mediump sampler2D;
precision mediump sampler3D;

in float position;

in vec2 linepoint_prev; // start of previous segment
in vec2 linepoint_start; // end of previous segment, start of current segment
in vec2 linepoint_end; // end of current segment, start of next segment
in vec2 linepoint_next; // end of next segment

uniform vec4 is_valid; // start of previous segment

uniform vec4 color_start; // end of previous segment, start of current segment
uniform vec4 color_end; // end of current segment, start of next segment

uniform float thickness_start;
uniform float thickness_end;

uniform vec2 resolution;
uniform mat4 projectionview;
uniform mat4 model;
uniform float pattern_length;

flat out vec2 f_uv_minmax;
out vec2 f_uv;
out vec4 f_color;
out float f_thickness;

#define MITER_LIMIT -0.4
#define AA_THICKNESS 4.0

vec3 screen_space(vec2 point) {
    vec4 vertex = projectionview * model * vec4(point, 0, 1);
    return vec3(vertex.xy * resolution, vertex.z) / vertex.w;
}

void emit_vertex(vec3 position, vec2 uv, bool is_start) {

    f_uv = uv;

    f_color = is_start ? color_start : color_end;

    gl_Position = vec4((position.xy / resolution), position.z, 1.0);
    f_thickness = is_start ? thickness_start : thickness_end;
}

void main() {
    vec3 p0 = screen_space(linepoint_prev);
    vec3 p1 = screen_space(linepoint_start);
    vec3 p2 = screen_space(linepoint_end);
    vec3 p3 = screen_space(linepoint_next);
    vec2 dir = p1.xy - p2.xy;
    dir = normalize(dir);
    vec2 line_normal = vec2(dir.y, -dir.x);
    vec2 line_offset = line_normal * (thickness_start / 2.0);

    vec2 tangent = normalize(normalize(p2 - p1) + normalize(p1 - p0));

    vec2 miter = vec2(-tangent.y, tangent.x);
    // triangle 1
    vec3 v0 = vec3(p1.xy - line_offset, p1.z);
    if (position == 0.0) {
        emit_vertex(v0, vec2(0.0, 0.0), true);
        return;
    }
    vec3 v2 = vec3(p2.xy - line_offset, p2.z);
    if (position == 1.0) {
        emit_vertex(v2, vec2(0.0, 0.0), true);
        return;
    }
    vec3 v1 = vec3(p1.xy + line_offset, p1.z);
    if (position == 2.0) {
        emit_vertex(v1, vec2(0.0, 0.0), false);
        return;
    }

    // triangle 2
    if (position == 3.0) {
        emit_vertex(v2, vec2(0.0, 0.0), false);
        return;
    }
    vec3 v3 = vec3(p2.xy + line_offset, p2.z);
    if (position == 4.0) {
        emit_vertex(v3, vec2(0.0, 0.0), false);
        return;
    }
    if (position == 5.0) {
        emit_vertex(v1, vec2(0.0, 0.0), false);
        return;
    }
}
`;

const LINES_FRAG = `#version 300 es
precision mediump int;
precision highp float;
precision mediump sampler2D;
precision mediump sampler3D;

flat in vec2 f_uv_minmax;
in vec2 f_uv;
in vec4 f_color;
in float f_thickness;

uniform float pattern_length;

out vec4 fragment_color;

// Half width of antialiasing smoothstep
#define ANTIALIAS_RADIUS 0.8

float aastep(float threshold1, float dist) {
    return smoothstep(threshold1-ANTIALIAS_RADIUS, threshold1+ANTIALIAS_RADIUS, dist);
}

float aastep(float threshold1, float threshold2, float dist) {
    // We use 2x pixel space in the geometry shaders which passes through
    // in uv.y, so we need to treat it here by using 2 * ANTIALIAS_RADIUS
    float AA = 2.0 * ANTIALIAS_RADIUS;
    return smoothstep(threshold1 - AA, threshold1 + AA, dist) -
           smoothstep(threshold2 - AA, threshold2 + AA, dist);
}

float aastep_scaled(float threshold1, float threshold2, float dist) {
    float AA = ANTIALIAS_RADIUS / pattern_length;
    return smoothstep(threshold1 - AA, threshold1 + AA, dist) -
           smoothstep(threshold2 - AA, threshold2 + AA, dist);
}

void main(){
    // vec4 color = vec4(f_color.rgb, 0.0);
    // vec2 xy = f_uv;

    // float alpha = aastep(0.0, xy.x);
    // float alpha2 = aastep(-f_thickness, f_thickness, xy.y);
    // float alpha3 = aastep_scaled(f_uv_minmax.x, f_uv_minmax.y, f_uv.x);

    // color = vec4(f_color.rgb, f_color.a * alpha * alpha2 * alpha3);

    fragment_color = f_color;
}
`;

function create_line_material(uniforms) {
    return new THREE.RawShaderMaterial({
        uniforms: deserialize_uniforms(uniforms),
        vertexShader: LINES_VERT,
        fragmentShader: LINES_FRAG,
        transparent: true,
    });
}

function create_line_geometry(linepoints, linesegments) {
    const geometry = new THREE.InstancedBufferGeometry();
    const instance_positions = [0, 1, 2, 3, 4, 5];
    geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(instance_positions, 1)
    );
    const N = linepoints.length;
    let points;
    if (linesegments) {
        const N2 = linepoints.length + 4;
        points = new Float32Array(N2);
        points[0] = linepoints[0];
        points[1] = linepoints[1];
        points.set(linepoints, 2);
        points[N2 - 2] = linepoints[N - 2];
        points[N2 - 1] = linepoints[N - 1];
    } else {
        const N2 = linepoints.length * 2 + 4;
        points = new Float32Array(N2);
        points[0] = linepoints[0];
        points[1] = linepoints[1];
        for (let i = 0; i < linepoints.length; i += 2) {
            points[2 * i + 2] = linepoints[i];
            points[2 * i + 3] = linepoints[i + 1];

            points[2 * i + 4] = linepoints[i + 2];
            points[2 * i + 5] = linepoints[i + 3];
        }

        points[N2 - 2] = linepoints[N - 2];
        points[N2 - 1] = linepoints[N - 1];
    }

    const instanceBuffer = new THREE.InstancedInterleavedBuffer(points, 4, 1); // xy1, xy2

    geometry.setAttribute(
        "linepoint_prev",
        new THREE.InterleavedBufferAttribute(instanceBuffer, 2, 0)
    ); // xyz1
    geometry.setAttribute(
        "linepoint_start",
        new THREE.InterleavedBufferAttribute(instanceBuffer, 2, 2)
    ); // xyz1
    geometry.setAttribute(
        "linepoint_end",
        new THREE.InterleavedBufferAttribute(instanceBuffer, 2, 4)
    ); // xyz1
    geometry.setAttribute(
        "linepoint_next",
        new THREE.InterleavedBufferAttribute(instanceBuffer, 2, 6)
    ); // xyz2

    geometry.boundingSphere = new THREE.Sphere();
    // don't use intersection / culling
    geometry.boundingSphere.radius = 10000000000000;
    geometry.frustumCulled = false;
    geometry.instanceCount = (points.length - 4) / 4;

    return geometry;
}

export function create_line(line_data) {
    const geometry = create_line_geometry(
        line_data.positions,
        line_data.is_linesegments
    );
    const material = create_line_material(line_data.uniforms);
    console.log(material);
    return new THREE.Mesh(geometry, material);
}

// global scene cache to look them up for dynamic operations in Makie
// e.g. insert!(scene, plot) / delete!(scene, plot)
const scene_cache = {};
const plot_cache = {};
const TEXTURE_ATLAS = [undefined];

function add_scene(scene_id, three_scene) {
    scene_cache[scene_id] = three_scene;
}

export function find_scene(scene_id) {
    return scene_cache[scene_id];
}

export function delete_scene(scene_id) {
    const scene = scene_cache[scene_id];
    if (!scene) {
        return;
    }
    while (scene.children.length > 0) {
        scene.remove(scene.children[0]);
    }
    delete scene_cache[scene_id];
}

export function find_plots(plot_uuids) {
    const plots = [];
    plot_uuids.forEach((id) => {
        const plot = plot_cache[id];
        if (plot) {
            plots.push(plot);
        }
    });
    return plots;
}

export function delete_scenes(scene_uuids, plot_uuids) {
    plot_uuids.forEach((plot_id) => {
        delete plot_cache[plot_id];
    });
    scene_uuids.forEach((scene_id) => {
        delete_scene(scene_id);
    });
}

export function insert_plot(scene_id, plot_data) {
    const scene = find_scene(scene_id);
    plot_data.forEach((plot) => {
        add_plot(scene, plot);
    });
}

export function delete_plots(scene_id, plot_uuids) {
    console.log(`deleting plots!: ${plot_uuids}`);
    const scene = find_scene(scene_id);
    const plots = find_plots(plot_uuids);
    plots.forEach((p) => {
        scene.remove(p);
        delete plot_cache[p];
    });
}

function convert_texture(data) {
    const tex = create_texture(data);
    tex.needsUpdate = true;
    tex.minFilter = THREE[data.minFilter];
    tex.magFilter = THREE[data.magFilter];
    tex.anisotropy = data.anisotropy;
    tex.wrapS = THREE[data.wrapS];
    if (data.size.length > 1) {
        tex.wrapT = THREE[data.wrapT];
    }
    if (data.size.length > 2) {
        tex.wrapR = THREE[data.wrapR];
    }
    return tex;
}

function is_three_fixed_array(value) {
    return (
        value instanceof THREE.Vector2 ||
        value instanceof THREE.Vector3 ||
        value instanceof THREE.Vector4 ||
        value instanceof THREE.Matrix4
    );
}

function to_uniform(data) {
    if (data.type !== undefined) {
        if (data.type == "Sampler") {
            return convert_texture(data);
        }
        throw new Error(`Type ${data.type} not known`);
    }
    if (Array.isArray(data) || ArrayBuffer.isView(data)) {
        if (!data.every((x) => typeof x === "number")) {
            // if not all numbers, we just leave it
            return data;
        }
        // else, we convert it to THREE vector/matrix types
        if (data.length == 2) {
            return new THREE.Vector2().fromArray(data);
        }
        if (data.length == 3) {
            return new THREE.Vector3().fromArray(data);
        }
        if (data.length == 4) {
            return new THREE.Vector4().fromArray(data);
        }
        if (data.length == 16) {
            const mat = new THREE.Matrix4();
            mat.fromArray(data);
            return mat;
        }
    }
    // else, leave unchanged
    return data;
}

function deserialize_uniforms(data) {
    const result = {};
    // Deno may change constructor names..so...

    for (const name in data) {
        const value = data[name];
        // this is already a uniform - happens when we attach additional
        // uniforms like the camera matrices in a later stage!
        if (value instanceof THREE.Uniform) {
            // nothing needs to be converted
            result[name] = value;
        } else {
            const ser = to_uniform(value);
            result[name] = new THREE.Uniform(ser);
        }
    }
    return result;
}

export function deserialize_plot(data) {
    if (data.plot_type === "lines") {
        return create_line(data);
    }
    let mesh;
    if ("instance_attributes" in data) {
        mesh = create_instanced_mesh(data);
    } else {
        mesh = create_mesh(data);
    }
    mesh.name = data.name;
    mesh.frustumCulled = false;
    mesh.matrixAutoUpdate = false;
    mesh.plot_uuid = data.uuid;
    const update_visible = (v) => {
        mesh.visible = v;
        // don't return anything, since that will disable on_update callback
        return;
    };
    update_visible(data.visible.value);
    data.visible.on(update_visible);
    connect_uniforms(mesh, data.uniform_updater);
    connect_attributes(mesh, data.attribute_updater);
    return mesh;
}

const ON_NEXT_INSERT = new Set();

export function on_next_insert(f) {
    ON_NEXT_INSERT.add(f);
}

export function add_plot(scene, plot_data) {
    // fill in the camera uniforms, that we don't sent in serialization per plot
    const cam = scene.wgl_camera;
    const identity = new THREE.Uniform(new THREE.Matrix4());
    if (plot_data.cam_space == "data") {
        plot_data.uniforms.view = cam.view;
        plot_data.uniforms.projection = cam.projection;
        plot_data.uniforms.projectionview = cam.projectionview;
        plot_data.uniforms.eyeposition = cam.eyeposition;
    } else if (plot_data.cam_space == "pixel") {
        plot_data.uniforms.view = identity;
        plot_data.uniforms.projection = cam.pixel_space;
        plot_data.uniforms.projectionview = cam.pixel_space;
    } else if (plot_data.cam_space == "relative") {
        plot_data.uniforms.view = identity;
        plot_data.uniforms.projection = cam.relative_space;
        plot_data.uniforms.projectionview = cam.relative_space;
    } else {
        // clip space
        plot_data.uniforms.view = identity;
        plot_data.uniforms.projection = identity;
        plot_data.uniforms.projectionview = identity;
    }

    plot_data.uniforms.resolution = cam.resolution;

    if (plot_data.uniforms.preprojection) {
        const { space, markerspace } = plot_data;
        plot_data.uniforms.preprojection = cam.preprojection_matrix(
            space.value,
            markerspace.value
        );
    }
    const p = deserialize_plot(plot_data);
    plot_cache[plot_data.uuid] = p;
    scene.add(p);
    // execute all next insert callbacks
    const next_insert = new Set(ON_NEXT_INSERT); // copy
    next_insert.forEach((f) => f());
}

function connect_uniforms(mesh, updater) {
    updater.on(([name, data]) => {
        // this is the initial value, which shouldn't end up getting updated -
        // TODO, figure out why this gets pushed!!
        if (name === "none") {
            return;
        }
        const uniform = mesh.material.uniforms[name];
        if (uniform.value.isTexture) {
            const im_data = uniform.value.image;
            const [size, tex_data] = data;
            if (tex_data.length == im_data.data.length) {
                im_data.data.set(tex_data);
            } else {
                const old_texture = uniform.value;
                uniform.value = re_create_texture(old_texture, tex_data, size);
                old_texture.dispose();
            }
            uniform.value.needsUpdate = true;
        } else {
            if (is_three_fixed_array(uniform.value)) {
                uniform.value.fromArray(data);
            } else {
                uniform.value = data;
            }
        }
    });
}

function create_texture(data) {
    const buffer = data.data;
    if (data.size.length == 3) {
        const tex = new THREE.DataTexture3D(
            buffer,
            data.size[0],
            data.size[1],
            data.size[2]
        );
        tex.format = THREE[data.three_format];
        tex.type = THREE[data.three_type];
        return tex;
    } else {
        // a little optimization to not send the texture atlas over & over again
        const tex_data =
            buffer == "texture_atlas" ? TEXTURE_ATLAS[0].value : buffer;
        return new THREE.DataTexture(
            tex_data,
            data.size[0],
            data.size[1],
            THREE[data.three_format],
            THREE[data.three_type]
        );
    }
}

function re_create_texture(old_texture, buffer, size) {
    if (size.length == 3) {
        const tex = new THREE.DataTexture3D(buffer, size[0], size[1], size[2]);
        tex.format = old_texture.format;
        tex.type = old_texture.type;
        return tex;
    } else {
        return new THREE.DataTexture(
            buffer,
            size[0],
            size[1] ? size[1] : 1,
            old_texture.format,
            old_texture.type
        );
    }
}
function BufferAttribute(buffer) {
    const jsbuff = new THREE.BufferAttribute(buffer.flat, buffer.type_length);
    jsbuff.setUsage(THREE.DynamicDrawUsage);
    return jsbuff;
}

function InstanceBufferAttribute(buffer) {
    const jsbuff = new THREE.InstancedBufferAttribute(
        buffer.flat,
        buffer.type_length
    );
    jsbuff.setUsage(THREE.DynamicDrawUsage);
    return jsbuff;
}

function attach_geometry(buffer_geometry, vertexarrays, faces) {
    for (const name in vertexarrays) {
        const buff = vertexarrays[name];
        let buffer;
        if (buff.to_update) {
            buffer = new THREE.BufferAttribute(buff.to_update, buff.itemSize);
        } else {
            buffer = BufferAttribute(buff);
        }
        buffer_geometry.setAttribute(name, buffer);
    }
    buffer_geometry.setIndex(faces);
    buffer_geometry.boundingSphere = new THREE.Sphere();
    // don't use intersection / culling
    buffer_geometry.boundingSphere.radius = 10000000000000;
    buffer_geometry.frustumCulled = false;
    return buffer_geometry;
}

function attach_instanced_geometry(buffer_geometry, instance_attributes) {
    for (const name in instance_attributes) {
        const buffer = InstanceBufferAttribute(instance_attributes[name]);
        buffer_geometry.setAttribute(name, buffer);
    }
}

function recreate_geometry(mesh, vertexarrays, faces) {
    const buffer_geometry = new THREE.BufferGeometry();
    attach_geometry(buffer_geometry, vertexarrays, faces);
    mesh.geometry.dispose();
    mesh.geometry = buffer_geometry;
    mesh.needsUpdate = true;
}

function recreate_instanced_geometry(mesh) {
    const buffer_geometry = new THREE.InstancedBufferGeometry();
    const vertexarrays = {};
    const instance_attributes = {};
    const faces = [...mesh.geometry.index.array];
    Object.keys(mesh.geometry.attributes).forEach((name) => {
        const buffer = mesh.geometry.attributes[name];
        // really dont know why copying an array is considered rocket science in JS
        const copy = buffer.to_update
            ? buffer.to_update
            : buffer.array.map((x) => x);
        if (buffer.isInstancedBufferAttribute) {
            instance_attributes[name] = {
                flat: copy,
                type_length: buffer.itemSize,
            };
        } else {
            vertexarrays[name] = {
                flat: copy,
                type_length: buffer.itemSize,
            };
        }
    });
    attach_geometry(buffer_geometry, vertexarrays, faces);
    attach_instanced_geometry(buffer_geometry, instance_attributes);
    mesh.geometry.dispose();
    mesh.geometry = buffer_geometry;
    mesh.needsUpdate = true;
}

function create_material(program) {
    const is_volume = "volumedata" in program.uniforms;
    return new THREE.RawShaderMaterial({
        uniforms: deserialize_uniforms(program.uniforms),
        vertexShader: program.vertex_source,
        fragmentShader: program.fragment_source,
        side: is_volume ? THREE.BackSide : THREE.DoubleSide,
        transparent: true,
        depthTest: !program.overdraw.value,
        depthWrite: !program.transparency.value,
    });
}

function create_mesh(program) {
    const buffer_geometry = new THREE.BufferGeometry();
    const faces = new THREE.BufferAttribute(program.faces.value, 1);
    attach_geometry(buffer_geometry, program.vertexarrays, faces);
    const material = create_material(program);
    const mesh = new THREE.Mesh(buffer_geometry, material);
    program.faces.on((x) => {
        mesh.geometry.setIndex(new THREE.BufferAttribute(x, 1));
    });
    return mesh;
}

function create_instanced_mesh(program) {
    const buffer_geometry = new THREE.InstancedBufferGeometry();
    const faces = new THREE.BufferAttribute(program.faces.value, 1);
    attach_geometry(buffer_geometry, program.vertexarrays, faces);
    attach_instanced_geometry(buffer_geometry, program.instance_attributes);
    const material = create_material(program);
    const mesh = new THREE.Mesh(buffer_geometry, material);
    program.faces.on((x) => {
        mesh.geometry.setIndex(new THREE.BufferAttribute(x, 1));
    });
    return mesh;
}

function first(x) {
    return x[Object.keys(x)[0]];
}

function connect_attributes(mesh, updater) {
    const instance_buffers = {};
    const geometry_buffers = {};
    let first_instance_buffer;
    const real_instance_length = [0];
    let first_geometry_buffer;
    const real_geometry_length = [0];

    function re_assign_buffers() {
        const attributes = mesh.geometry.attributes;
        Object.keys(attributes).forEach((name) => {
            const buffer = attributes[name];
            if (buffer.isInstancedBufferAttribute) {
                instance_buffers[name] = buffer;
            } else {
                geometry_buffers[name] = buffer;
            }
        });
        first_instance_buffer = first(instance_buffers);
        // not all meshes have instances!
        if (first_instance_buffer) {
            real_instance_length[0] = first_instance_buffer.count;
        }
        first_geometry_buffer = first(geometry_buffers);
        real_geometry_length[0] = first_geometry_buffer.count;
    }

    re_assign_buffers();

    updater.on(([name, new_values, length]) => {
        const buffer = mesh.geometry.attributes[name];
        let buffers;
        let first_buffer;
        let real_length;
        let is_instance = false;
        // First, we need to figure out if this is an instance / geometry buffer
        if (name in instance_buffers) {
            buffers = instance_buffers;
            first_buffer = first_instance_buffer;
            real_length = real_instance_length;
            is_instance = true;
        } else {
            buffers = geometry_buffers;
            first_buffer = first_geometry_buffer;
            real_length = real_geometry_length;
        }
        if (length <= real_length[0]) {
            // this is simple - we can just update the values
            buffer.set(new_values);
            buffer.needsUpdate = true;
            if (is_instance) {
                mesh.geometry.instanceCount = length;
            }
        } else {
            // resizing is a bit more complex
            // first we directly overwrite the array - this
            // won't have any effect, but like this we can collect the
            // newly sized arrays untill all of them have the same length
            buffer.to_update = new_values;
            const all_have_same_length = Object.values(buffers).every(
                (x) => x.to_update && x.to_update.length / x.itemSize == length
            );
            if (all_have_same_length) {
                if (is_instance) {
                    recreate_instanced_geometry(mesh);
                    // we just replaced geometry & all buffers, so we need to update these
                    re_assign_buffers();
                    mesh.geometry.instanceCount =
                        new_values.length / buffer.itemSize;
                } else {
                    recreate_geometry(mesh, buffers, mesh.geometry.index);
                    re_assign_buffers();
                }
            }
        }
    });
}

export function deserialize_scene(data, screen) {
    const scene = new THREE.Scene();
    scene.screen = screen;
    const { canvas } = screen;
    add_scene(data.uuid, scene);
    scene.scene_uuid = data.uuid;
    scene.frustumCulled = false;
    scene.pixelarea = data.pixelarea;
    scene.backgroundcolor = data.backgroundcolor;
    scene.clearscene = data.clearscene;
    scene.visible = data.visible;

    const camera = new Camera.MakieCamera();

    scene.wgl_camera = camera;

    function update_cam(camera_matrices) {
        const [view, projection, resolution, eyepos] = camera_matrices;
        camera.update_matrices(view, projection, resolution, eyepos);
    }

    update_cam(data.camera.value);

    if (data.cam3d_state) {
        Camera.attach_3d_camera(canvas, camera, data.cam3d_state, scene);
    } else {
        data.camera.on(update_cam);
    }
    data.plots.forEach((plot_data) => {
        add_plot(scene, plot_data);
    });
    scene.scene_children = data.children.map((child) =>
        deserialize_scene(child, screen)
    );
    return scene;
}

export function delete_plot(plot) {
    delete plot_cache[plot.plot_uuid];
    const { parent } = plot;
    if (parent) {
        parent.remove(plot);
    }
    plot.geometry.dispose();
    plot.material.dispose();
}

export function delete_three_scene(scene) {
    delete scene_cache[scene.scene_uuid];
    scene.scene_children.forEach(delete_three_scene);
    while (scene.children.length > 0) {
        delete_plot(scene.children[0]);
    }
}

export { TEXTURE_ATLAS, scene_cache, plot_cache };