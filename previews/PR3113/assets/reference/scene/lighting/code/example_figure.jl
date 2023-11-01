# This file was generated, do not modify it. # hide
using Makie.LaTeXStrings: @L_str # hide
__result = begin # hide
    using GLMakie
GLMakie.activate!() # hide
GLMakie.closeall() # hide

lights = [
    SpotLight(RGBf(1, 0, 0), Point3f(-3, 0, 3), Vec3f(0,  0, -1), Vec2f(0.0, 0.3pi)),
    SpotLight(RGBf(0, 1, 0), Point3f( 0, 3, 3), Vec3f(0, -0.5, -1), Vec2f(0.2pi, 0.25pi)),
    SpotLight(RGBf(0, 0, 1), Point3f( 3, 0, 3), Vec3f(0,  0, -1), Vec2f(0.25pi, 0.25pi)),
]

fig = Figure(resolution = (600, 600))
ax = LScene(fig[1, 1], scenekw = (lights = lights,))
ps = [Point3f(x, y, 0) for x in -5:5 for y in -5:5]
meshscatter!(ax, ps, color = :white, markersize = 0.75)
scatter!(ax, map(l -> l.position[], lights), color = map(l -> l.color[], lights), strokewidth = 1, strokecolor = :black)
fig
end # hide
save(joinpath(@OUTPUT, "example_11579835501237938835.png"), __result; ) # hide

nothing # hide