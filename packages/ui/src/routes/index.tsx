import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: AdminIndex,
})

function AdminIndex() {
  return (
    <div className=" min-h-screen flex flex-col justify-center items-center ">
      <div className="relative max-w-lg flex flex-col items-center gap-y-3 w-full p-8 rounded-2xl backdrop-blur-md bg-white/5 border border-white/10 shadow-2xl">
        <div
          id="middleDiv"
          className="absolute top-0 left-0 w-full h-[3px] bg-linear-to-r from-transparent via-[#00eaff] to-transparent blur-sm"
        ></div>

        <h1 className="text-[20px] lg:text-[36px] font-extrabold bg-clip-text text-transparent bg-linear-to-tr from-gray-700 to-blue-400">
          Welcome to AdminGen
        </h1>

        <p className="text-[14px] lg:text-[18px] text-gray-300 ">
          Select a resource from the sidebar to get started.
        </p>
      </div>
    </div>
  )
}
