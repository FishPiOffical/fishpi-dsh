/**
 * Browser half of the FishPi chat plugin.
 *
 * Registers:
 * - a right-Sidebar tab type (`fishpi.chat`) with a guide entry and a live tab title;
 * - a chat button in the Session header's utilities;
 * - a Settings section (`settings.section`) with account login and display preferences.
 *
 * All FishPi traffic goes through the Host routes under `api/fishpi/*`, so the
 * page never contacts fishpi.cn and never holds the password or token.
 */

window.__ModuleLoader__.load({
  id: '@iwpz/fishpi-dsh',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const {
      useCallback,
      useEffect,
      useLayoutEffect,
      useRef,
      useState,
      useSyncExternalStore,
    } = React

    /** Right-Sidebar tab kind; opened by the guide entry and the header button. */
    const TAB_KIND = 'fishpi.chat'
    /** Tab implementation identity: the key its body, title, and definition share. */
    const TAB_ID = '@iwpz/fishpi-dsh'
    /** Client locale namespace. */
    const NS = 'fishpiChat'
    /** Host route prefix, document-relative so deployments under a path prefix work. */
    const API = 'api/fishpi'
    /** Local preference document. */
    const PREFS_KEY = 'fishpi-chat.prefs.v1'
    /** FishPi registration page, returning to the chatroom after sign-up. */
    const REGISTER_URL = 'https://fishpi.cn/register?goto=https%3A%2F%2Ffishpi.cn%2Fcr'
    /** Message window size used by the initial load and by sync/reconnect. */
    const WINDOW_SIZE = 30
    /** A longer server-published topic or message is clipped for display. */
    const MAX_TOPIC = 160
    /** Retained messages before the oldest is dropped from the live window. */
    const MAX_RETAINED = 400
    /**
     * The FishPi home logo animation (`#logo-animate`, a three-image Lottie
     * composition). Its asset bytes and keyframes are embedded so the icons
     * animate offline with no player dependency.
     */
    const LOGO_ANIMATION = {"v":"5.12.2","fr":25,"ip":0,"op":75,"w":800,"h":800,"nm":"fishpi","ddd":0,"assets":[{"id":"image_0","w":200,"h":200,"u":"","p":"data:image/png;base64,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","e":1},{"id":"image_1","w":800,"h":800,"u":"","p":"data:image/png;base64,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","e":1},{"id":"image_2","w":800,"h":800,"u":"","p":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAyAAAAMgBAMAAAApXhtbAAAAJHpUWHRDcmVhdG9yAAAImXNMyU9KVXBMK0ktUnBNS0tNLikGAEF6Bs5qehXFAAAACXBIWXMAAAABAAAAAQBPJcTWAAAALVBMVEVHcEwEAAADAAAEAAADAAADAAAEAADtjyb///80HwvHeB9lPhWZWxjZmVWfnp5aiQZgAAAABnRSTlMAI96zUIJQWWP+AAAXKklEQVR42uzdTU8bSRrA8VhL7hBg7msSnzd2yBnCy3kCIfc0My15ifbaWsMHQFopR2c9oD2OheFMhhflCOLlc4wSjZTPsIaQBHdX21XVVeXu8v93nxnGTz9PVT1VXf3gAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKLbxb0r8FkNXmlhcWlut3ZidXVtbnJ/gNxmSicVuIMphUrnWjcs4P5DbWNTK5SAIU5XLM7OvSBYXJWpqrVYtl8PByrdBIVWsZsZSt0iVK6G0oFyuzS4SE1upUVMJxo9MqXUThR/QcDSWVqvlUFdATIyaWhJPp9QSpbZGTEyVqszR+GqmOx9m5pV5gluthMYEM7MsUTKtwleroWFB7RWred3sWK2ENsysERKNcEythtYEs4sTVC61odxSdvxIEzorCsZsh+NrSEgSyfRYcBCO28r1jJDIrAOroTPl2Tl+8AHhWC2HDgXlWdbv/arVUrUSulWeISR9BvNy6B4hSbNUq4RDUa4xCRaWq3BoAnZ8k6N5JRymMluLuUmPHz0uQpKjeNwu3hnd7+JRCXPhputIOB5MLIS5Ecy6qVuliYmpxcXF+fmJ/D0BEyv6v1+9Xm9902w268XoA5cmvm9MB91FUM5Cot27qrdOTq8vO9F3nc719clRM3tI5m1X6GqO+85jz3VisXN62Y5SNA6uTjJGZdbmLzRddf4IqOSHcjxaJ9edaKDO9UkrU92y9gBWc70TMF1VzIzrTrsdSWl3K5h+pgR2+lulpZRuXfBkrnDxuEmNjmQ07opXo3NwpZsoMxYe2j7d02BmrlDxaJ1cqgXj3kh/pTfQl2umk2Sq3+ZCDiIiPb/qVqrLTqRNNybBzNq4w+dv6FVLNh47p9cZovFt5qU1yBsdSQa2hwKrk7vB8VjJPMFVy5MDnTQxt0aQaNcFr4YYj7FVyXBE5ujMhQ31UkpLMvP79ZfD6ydKnPXphqMTmdU4OGk1lZPEQG9jSW699WQ8v/Got07bkQXdiXDT+UgiGY8wHNYCcXpgPCyF4zZNlAeTmYxlS74fEQyniTLwD6zvXEYWNQ4UQxI8m7A+fxli0SoNiofdcHytXEdqSfJE/9EtqewvBEMY10svBqTHaeSCYkj0f6kXSv+ddfcpMjkgPc4jR7bUQqJZTSYV96ef5mtArx+3I3eUsiSYeWll/hKfQThOkbFq/9HDZTxuh3eVfqP6rHRMfUPUbYqUVvuOHp3ItY5KSJQPy5c0Dgy4TZF+FbV+2o6GoHN9pFC21PpNWi8fuZxo9dtCd12u7u/Cy/e4lNqN0zonBsJf3aVInwyuO1h89OtxSa8UFTopY3onnByuRdKPKNZP2tEwNa6lF++B7Lls7bclHw+/ZTKk4aNnKJGvW5Jla1ozHuH63LALVg7icbMqkd4uCZ7NZ5xh1Vuto5OdVmuoM9/UJ6Z+HOWDfN2SGEgWBm+ENlKeATfDeuoMKzfxuGnNyybJwJb8VKXP/KXdv1kQOKlZC/mPh0qDK+g/kJReS9bnxoVoo8pBPB5WihCPrv2m7EAyrtNC3UhM7y+G0/NdKUg8Up5Zxf5van3eEUxfzpLB/nlYI3oO46HQBU4/JpK2CbIrmk42Dt3XrFJK1zOX8bhZlMjVrfIrtQllyubCQdN5zUopqblYf2Tpy5eFxw3TliBp/7vJImm7ZqWU1N28xkM+SQLRjUIpLaL0x2+r6bhmLRQuHtJJImg2puxK9SsH+4kJwxASZOM8yrcDuSRJ7JEsSM+vfqTIocu1YUn4F9Yvo7xryO1dxZqN4sdvwPbChct+lrDL6+i0T+aGY1N51a71+DWaDmvWQvEGEMXu1v2BRNjEGrzeiqdIMO42QXaKEY/bVWJTJSLic4C7g5to8f/Kz04TpAADyL0kkSlb3w6bChNE4vFLLNf/7nSKdRwVyYFMRNbnUxOkLjOfjM98f3GZILtRsTRkZlu3hxPGKrqPX3xYt9U9EZ11r7ejotmXPFG1ov/4xZu+lgIyWfiCdVe2DmXegBJ1FTckH7/N2D835yxBdqMi6khskwTlDDsM8Zpl53jW3yp6Q1yBe/LaC64zF2v1FT8KllJPXrdjt+lg3iuYdBRnSSgYSC6UA6Lw+MVq1hsbAXlR6CWhgbL1VuXxO7S+EBEsCnejQmtcKZUttfFyz3pAJou3CSLR21IZ0ZX+1b39rF/ML0QEp8WOo6j4EWlaGNGTAbFwoDR5OG6jXfyASHYbNR4/6xnywscEuW2kyB0BVp1Q2s6Q5JDuRYJIDyTKpwBjGWL+tGLiT/wQ+ULmvOlb1X/ppuVZVmKVvhN55MrslDcZkDf2V+nnPgVk4DF55QSJ/m23dTLpdYIM7Mhr9FAv7DYXq55Ose41Uo6MrQkFrZOntitWkbuKqa0tkwkSNa3uh0x6nyB9m40aCbJld8ew6usaRGrVrpMgm1ZPyiUqlo8Jkr5G1Glqn1k9dTJZ/JMmGSKitU3dO6b/arhivfZrH0RxsqXzf7tl9aBcvGIV9WSD3EASb8hr/d/uWd1Sn8yylVn4oV2rHJxZPWy9PCJDujAiWi97x49lmZ31liqjMqSLOltaM/zYYdXAbuf9t8h7947IHxuoWIbfoHrkdZ83ZZZ0mCVB4i/smB3T46cbNqJR8G36q1UO4hXrH1Ynvb9FoxGRC+05b/wFKsOvRU+P2pB+v/urNeeNV6x1q8dNNqJRcTP91RovL6zeTBp/KeQ4GqGIaCVI4jX1lzaHEK/bJsmyZWBINz2ETPq9l24hrw7lL6szMIQc84srJojh25liQ8hoVSwtR3bvL4sNIX7u3Zq0afmGv+mRXBVmcGb5Ov6F0etjZWuC2f5gxWsqVrYEMVyxYmP6W35xxQQxXbFi700x6R2wBklebG34i7iTTHpVHFj/WsULhpAsi3Tz7yE8H5XzWHYW6cZviC0xhGRLENOf8I6N6VSsvq6E16CZvZCJIURhytu0/zGXR6xC5F04+NzRCo0s+Slv08EHwZ7TyMowopu/Yrx3klXnV1ea8lr4ksvDET1vYmZENz7njU+y/snPrjSiW7iK9Keef/979T+zc3nZGdWCZeOOrOVMY/rW1+91DPXr6kMc0W3c1fs6wxnSxlXzrqzW6wX5vojZgmUhQXp3p9TG9N7v0HqeJMKraywkSO+s961+PMKwdTlqBcvGZ7vHtNfpye8075yPVsGyctv7tO4kS/SJDg+vq+lXsKx8175n/7b+IVMfOqz7ursl/kCMlc8hPNLcTxd/Vaju6TBypfg1cFPrQvlZb9qdkn4WLeHTF9j5Xsiy3qw39f5CH3eAhTMsSwnS+/rt22x/oq87jsKCZemD3b0BkR6TN43d1l3UghXOPrATkOday5AjQx/gKG7BsvV16N6AyM56t/rdgOvb6lA8fbH1Qfved3VkA7Jn7hMcubcpfPhsfUUy1sqSfbj7Xkjs17CeMn15/MBFQGTXhZv97+z+4H/BCmfmXJQs2YDsmfxsUM6lDJfBszxlyICPmnpVsxopd2Gvu5hlSQakIXhoWicnR36+YZLWJLKUImMaAUmuCjc+fvn06cuXIy/XhlviRZelhUjvOuRcbwjZ+bJ968tfTR8nvgcuJ1o6JSv+jt3Op+077z57edpO3Em1kyIaGRIfQurf49GNyJGXDUbxBf6P7WeI1AqiEfu7Pm7f867p43uj4oHdSopo9LJir2lvbPf47N3S8DYiR65SpLf9LvVDxk5U/tEbkNsUee9dC164PrSRIhoB2euXIF9TxMO3foQD+9NcBOT3nr/pv/GA3KSIj+/F7bvp+WoE5CxtinXn0M+3TIQDu4UUWVbdfu296uNfiXhs/8fT135Ew4j5o3KlZeUt3MPUOe/3muXni3H7To4CKQekd8cmWbFuapafAREVLfMz359UdzJ6ArIhCshnX68qF90aYHzm+yhTQARDyPb2X97eHb/vYFjPFpD/iQLyztuAOLh5pvf0+4bqH/VRGJCmt19XSC4PjR9gzBaQTyMWEMEJQdPD+rTqPQ49AflDFJDtQ38DkhzXTa/WH6q+jiCRIX96fEHHhe2aNab8fsjZoIB0M8TfgCRT5LHNgJyrBaQuDsifPt+YkkwRw70T5XcMfx8YkEOfL9JMpojZmlVSPm29N7hkeX2zaSJF3ljcw32vuFxNCYjX19IlUsTwPOu1andxa+As6/BDNEopYngnV/mdtsagdci75rnXAdmy289aVn3r8/65LHHrpNX2OiCJ2/jNblP9v72z2W0bu+I4Uyd7aaJ0X6nWesayso7G8gPYll+A6RAQMk+g+A0G6NKt4KLLGJa0NqDImGWK2HyRooCfoZQ9mREpivdDPBQ/fr9FkCBAQvPPc8/HPffcPxufi/6iKi6WfU7gVNSJ/Ml4BuanhJ6Tp/J72cfHrxV9U9033DMeNP5RtUFV+vHxN5JHE14ZH6FddSJxgsz/U3ZBopFvqk7kpfn5wNtEJ/L38g5pinsDqW/khlP1fxha7IcKupB1t55uxbdtPLf3Y3KjXAVuIImuWT+IZYZaEeuqE/l31bKQ2Gw91RL8j+az31ceZ7gWY1XiwoupoFf/zvyCndXJAf+M1k0qcWdSZM1K1avvWYyOud3oRf5bkSt6buW8+p7F/Jnppt6sXy4rcqnYjZxXf2keZoWKB8PH1cp7wRpOrJ/2Qi5Xt5ptvWoiHx5XDuEWy0Ae7mwVidSzUr1n563FYNLQ81w9PvuRx3nBTkRPL4fWH1C4Bv8+TUFObe4xDDVVDn99DPjf3BsWykCWIxo+2BbepnIV+PBduJqjkCOHJYbjp4tECnVnxeypL9T2kWdy27h7VvP442ayFGoa/7Me1kYdHmiRatz7yu7GivXpqYW6r2LydbvxXhGv/r1Y3Kv/fNHe/HGRHMjKkmu5aH0RS0TCrVkmA/nHhbWPkAu0e/AbuTvVT21HU6/6kUJtS4VDErtFaypX7z2yn2H5m2cs2gVUNymM7byQywxfb3Nf9Mj3/fuCFRRv0hhYP5ITJBxmmU+7Klp9d/0wrU16GI57U03VX1brwui4wT42i9atmCDhCTReyZsU4uf1mS9a4Y7SVAWJFE9+rqAeNmMJBQV5ve2zFV4Pm7D9k9zBtrBX9z5XUA/Pu9tOkJqgV/9XFfUwv/Lvk1wHfMSrl7VPYfSQeM+GaewraCERr15WJ+JfKu7ZuN5CEMEBG6WcKhrYx1Shh+nWyCe5KCtSgfeuKqmHqRsRDHsjFfgyzrvS0cPQe0oKEj76WcbR1A+eFiZJ8a2kIK+9cifrXz1N9N1neA93P2VBXkae67qiehg49nC1N21BIk6kXHHWSF8Pg5h/JDsvNuJEynTUfDT3TNB17Beyd4TteWXNDS/M9NAuM05lx8WGW65LtGbNTPXwPL0O7BuxvqyYluvy1LMs9PCGWoXfL8LX3X9Xyovqk/VwD+xDrXDUK3DZTmRPpBw1eD/xlli3e9y2rqGETxkK3MQaDXzL4NaTy7tut/biaIMiH5SKCB5HiC3Bl2DNUmx/BHoECfGBZ6nIV08yL4wpwRe+wqjQw+s+fdRv2puC33sDFyJyg15kH7foJqJIz91v1xoceVY28lH8Mqpoz3XBs3VVev77NROR7WvdLd2vnnDUu17xLfSFnRe3mnqsbc7pKRKZ5CBzUfHamlVcE5ldauuR4EYSot+P0re1xa5Zw6KaiGp3cL8eCvh/NC/GRxzUvogea3FWQffWVeGVt98L/9z104QqyrV6L0Sg1rthzSqkiYzmhno4TuPtZkViTxZPRefxb84Ni1hiVFYT1/VwXhy3ExS5v1YkIRKFkw3ubfi5dHp0e3F1o7PE4m/Utz94mfj09XpW4UxE6T7i9QhW69PELau7yep/shYzCLmQ2LS1UCYyUenhbtAj0Y08rVv+t4VrNFv/T3pigqwnSdbDWfK4XG3Ww3ES3MizJAv//n5y7z/MxS9qW12zTrftQN7hcqWhR5LzPWqrdhLHAXEm+FdHjr3tj03sTI9LpR41w49RkxNBQdbdekH8+kTZK6rQI2FvRPUP1wQFWa8wFsOvT9S9DIc148RYj79J6rHWDlSMzVzlcqUXmr5p2wjyvaggTkylLfclLXVru6uXKryxEaQmK0jc9kC+u+Y0WhPdE7239uLIXI+fHGFOvWItWtOx8p29P9H9ii0U+Yu0IHELaX4jLXWxxPNaPf1VxVgRmc1CZTye1/RwNtfRw+THrxumI/uOswsTGd7l0zzUy5XXNaw0Nc6MBPlBXpBYE8ljwj5bXKavh6EirXfObkwkf0P8Rr5GY7vbtajEmihymIEeG6o6OZtyOdPw5l6zW7N5AY0z3QzxfRYGsiljzZNjH2md+2gd1uxegLYimRhIfC6ifbIoFztRz3oM7NNjPUVa7zIS5FX843y+LpB5eK1tyuIvdBRxszKQ2IpWbgq/Iy3z2PrrVW9YhRsgs69o5USR2a1ewrb1y3rzdudJevK+SC4U0R0CcJjCx6vasTrJUI+4rcM8dGrprVba1V1lYaudgwhLtVmzwyKKTuXKtJqYrEjjQNQGt88Olzayq3zkQqdyZVct2fwW6hvag9ys9UhoHRvuJGcf6crhHqbat1aPTRJbg8z1SGgdG2Zf1xr5mquV9z71V1Xvnx1EKzK9HeiR1KiUsSKj2ULTPGQ+3Xr/vHPw7fNstrr9urMTko5NZFlGmemuVnbFXT3v3j8/P+t0Omfng37N2RUJUd96j76UdUwetOfHNLs9yddRX+LsksTuypiDLBJlRF9/nM9OPG22JOaqw9CpiZ3L4bZOnPKT3MsnaySjicmwq+TW9vJwpBj1JWckBr5j6T4OnWqgatKXCrc0a+x2rT7FdiOqIrREP8rF3EiOLDcm8u5GBNLEZTuJkR7uoEp6OM6x+pVc+dfZZ4F/HDyvlh5a7a7DcSq+JHDkpnK4g7pTNRKms6xKstgyCJ74i7GpHN5+v+ZUj4ZWA/JwfGVdTxnNbNQIzKPnVJKGZkt4YCa+uZ1MZg+L8aVnTmtQcypKQ/uEaqDJnT+51s7GfX8xt1JDrrRbjODX5Mzw+Grh+/eT5Cx+MpkFYtiZxlPpqrrmYa7I09iDxWJ51Xqgy2Ty/Ovv3Ad/8WBrGJlU2suoyG8L2FKYefDr1eIbwZ8ut5AC89hKEREwD1PPLko1Nj70Co15UKR5yGqlXYzPgP13yGBY15KkhfOIUD9u79B7VLCQqLYR5bEJMTm6dbxHnCKGJ+tTk6OHeWwKf7NfttydtW8Ww0iOs41/3c4AZ64wkrM2clTTSNzOOXJoGkkzg7QcOUyMpNNEjrytW3KuxG12qLHbrFtt5MhXBVjClbjseGyzcKUdArMfmKsYuIUjT0GRej8dM2lSsUqLemNrM1meN0aOFCVZHudu2yfkqCGwdDWWR+zNnXh3gBqC7mR17oE63eie9/t1oiphfxKIctbpNBNSlGazE2gx6OPEM3Qp/ePzgM5yJEXnIKDZarWWvw+UOA/soodh7GQJW9JfodfDXwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACUk/8DeM14cNwg/IoAAAAASUVORK5CYII=","e":1}],"layers":[{"ddd":0,"ind":1,"ty":2,"nm":"cat_l.png","cl":"png","refId":"image_0","sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":1,"k":[{"i":{"x":[0.833],"y":[0.833]},"o":{"x":[0.167],"y":[0.167]},"t":33,"s":[-8]},{"i":{"x":[0.833],"y":[0.833]},"o":{"x":[0.167],"y":[0.167]},"t":37,"s":[8.167]},{"i":{"x":[0.833],"y":[0.833]},"o":{"x":[0.167],"y":[0.167]},"t":44,"s":[-25.342]},{"i":{"x":[0.833],"y":[0.833]},"o":{"x":[0.167],"y":[0.167]},"t":57,"s":[-44]},{"t":68,"s":[-21]}],"ix":10},"p":{"a":1,"k":[{"i":{"x":0.833,"y":0.833},"o":{"x":0.167,"y":0.167},"t":33,"s":[578,228,0],"to":[10.333,6,0],"ti":[27.667,3.333,0]},{"i":{"x":0.833,"y":0.833},"o":{"x":0.167,"y":0.167},"t":37,"s":[640,264,0],"to":[-11.813,-1.423,0],"ti":[42.984,10.685,0]},{"i":{"x":0.833,"y":0.833},"o":{"x":0.167,"y":0.167},"t":44,"s":[634.737,265.568,0],"to":[-57.683,-14.339,0],"ti":[12.033,3.438,0]},{"i":{"x":0.833,"y":0.833},"o":{"x":0.167,"y":0.167},"t":57,"s":[412,208,0],"to":[-21,-6,0],"ti":[-18.333,-1.5,0]},{"t":68,"s":[522,217,0]}],"ix":2,"l":2},"a":{"a":0,"k":[100,100,0],"ix":1,"l":2},"s":{"a":1,"k":[{"i":{"x":[0.833,0.833,0.833],"y":[0.833,0.833,0.833]},"o":{"x":[0.167,0.167,0.167],"y":[0.167,0.167,0.167]},"t":33,"s":[33,33,100]},{"i":{"x":[0.833,0.833,0.833],"y":[0.833,0.833,0.833]},"o":{"x":[0.167,0.167,0.167],"y":[0.167,0.167,0.167]},"t":37,"s":[56,56,100]},{"i":{"x":[0.833,0.833,0.833],"y":[0.833,0.833,0.833]},"o":{"x":[0.167,0.167,0.167],"y":[0.167,0.167,0.167]},"t":44,"s":[44,44,100]},{"i":{"x":[0.833,0.833,0.833],"y":[0.833,0.833,0.833]},"o":{"x":[0.167,0.167,0.167],"y":[0.167,0.167,0.167]},"t":57,"s":[32.042,32.042,100]},{"t":68,"s":[57,57,100]}],"ix":6,"l":2}},"ao":0,"ip":33,"op":108,"st":33,"bm":0},{"ddd":0,"ind":2,"ty":2,"nm":"cat.png","cl":"png","refId":"image_1","sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":1,"k":[{"i":{"x":[0.833],"y":[0.833]},"o":{"x":[0.167],"y":[0.167]},"t":20,"s":[0]},{"i":{"x":[0.833],"y":[0.833]},"o":{"x":[0.167],"y":[0.167]},"t":26,"s":[9]},{"i":{"x":[0.833],"y":[0.833]},"o":{"x":[0.167],"y":[0.167]},"t":44,"s":[9.201]},{"i":{"x":[0.833],"y":[0.833]},"o":{"x":[0.167],"y":[0.167]},"t":57,"s":[-13.043]},{"t":69,"s":[4]}],"ix":10},"p":{"a":1,"k":[{"i":{"x":0.833,"y":0.833},"o":{"x":0.167,"y":0.167},"t":20,"s":[390,227,0],"to":[0,0,0],"ti":[2,-5,0]},{"i":{"x":0.833,"y":0.833},"o":{"x":0.167,"y":0.167},"t":26,"s":[390,266,0],"to":[-0.444,1.11,0],"ti":[0.904,-2.26,0]},{"i":{"x":0.833,"y":0.833},"o":{"x":0.167,"y":0.167},"t":44,"s":[477.912,319.219,0],"to":[-1.63,4.075,0],"ti":[25.061,7.513,0]},{"i":{"x":0.833,"y":0.833},"o":{"x":0.167,"y":0.167},"t":57,"s":[267.235,304.488,0],"to":[-23.651,-7.09,0],"ti":[0.755,-1.889,0]},{"t":69,"s":[378,296,0]}],"ix":2,"l":2},"a":{"a":0,"k":[400,400,0],"ix":1,"l":2},"s":{"a":1,"k":[{"i":{"x":[0.833,0.833,0.833],"y":[0.833,0.833,0.833]},"o":{"x":[0.167,0.167,0.167],"y":[0.167,0.167,0.167]},"t":20,"s":[6.5,6.5,100]},{"t":26,"s":[65.5,65.5,100]}],"ix":6,"l":2}},"ao":0,"ip":20,"op":95,"st":20,"bm":0},{"ddd":0,"ind":3,"ty":2,"nm":"fish.png","cl":"png","refId":"image_2","sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":1,"k":[{"i":{"x":[0.833],"y":[0.833]},"o":{"x":[0.167],"y":[0.167]},"t":0,"s":[0]},{"i":{"x":[0.833],"y":[0.833]},"o":{"x":[0.167],"y":[0.167]},"t":12,"s":[-23]},{"t":28,"s":[0]}],"ix":10},"p":{"a":1,"k":[{"i":{"x":0.833,"y":0.833},"o":{"x":0.167,"y":0.167},"t":0,"s":[402,1198,0],"to":[-1,-163.667,0],"ti":[0.333,133,0]},{"i":{"x":0.833,"y":0.833},"o":{"x":0.167,"y":0.167},"t":12,"s":[396,216,0],"to":[-0.333,-133,0],"ti":[-0.667,-30.667,0]},{"t":26,"s":[400,400,0]}],"ix":2,"l":2},"a":{"a":0,"k":[400,400,0],"ix":1,"l":2},"s":{"a":0,"k":[80,80,100],"ix":6,"l":2}},"ao":0,"ip":0,"op":75,"st":0,"bm":0}],"markers":[],"props":{}}

    const zh = {
      nav: '摸鱼派',
      tabTitle: '摸鱼派',
      open: '打开摸鱼派聊天室',
      'guide.title': '摸鱼派聊天室',
      'guide.description': '在右侧边栏收发摸鱼派聊天室消息',
      'day.today': '今天',
      'day.yesterday': '昨天',
      'status.connected': '已连接',
      'status.connecting': '连接中',
      'status.disconnected': '未连接',
      online: '在线 {count}',
      topic: '话题',
      refresh: '刷新',
      'loadOlder': '加载更早的消息',
      loading: '加载中…',
      empty: '还没有消息，来打个招呼吧',
      'login.title': '登录摸鱼派',
      'login.account': '账号或邮箱',
      'login.password': '密码',
      'login.mfa': '两步验证码（选填）',
      'login.remember': '在此设备保持登录',
      'login.submit': '登录',
      'login.busy': '登录中…',
      'login.hint': '登录后保存鱼排刷新凭据，重启 DSH 后无需重新登录。',
      'login.register': '去注册',
      'login.needMfa': '该账号启用了两步验证，请输入验证码后重试。',
      logout: '退出登录',
      'settings.title': '摸鱼派聊天室',
      'settings.account': '账号',
      'settings.loggedInAs': '已登录',
      'settings.display': '消息显示',
      'settings.display.hint': '富文本会渲染 Markdown、图片和链接；纯文本只显示文字内容。',
      'settings.display.rich': '富文本',
      'settings.display.plain': '纯文本',
      'settings.notifications': '桌面通知',
      'settings.notifications.hint': '当聊天室不在前台时，用系统通知提醒新消息。',
      'settings.notifications.denied': '浏览器拒绝了通知权限。',
      'settings.notifications.unsupported': '当前环境不支持系统通知。',
      'error.crash': '聊天室渲染失败',
      'host.restart': '插件 Host 还是旧版本，撤回和管理员撤回暂不可用。请完全退出 DSH 再重新打开。',
      'settings.update': '插件更新',
      'settings.update.versions': '当前 {current} · {latest}',
      'settings.update.check': '检查更新',
      'settings.update.checking': '检查中…',
      'settings.update.install': '立即安装',
      'settings.update.installing': '安装中…',
      'message.actions': '消息操作',
      'message.quoteShort': '引',
      'message.recallShort': '撤',
      'message.recallConfirmShort': '确',
      'message.mentionShort': '@',
      'message.repeatShort': '+1',
      'message.quote': '引用这条消息',
      'message.recall': '撤回这条消息（再次点击确认，撤回可能消耗积分）',
      'message.recallModerate': '撤回这条消息（管理员/OP/纪律委员操作；再次点击确认）',
      'message.recallConfirm': '再次点击确认撤回',
      'message.mention': '在输入框艾特这条消息的作者',
      'message.repeat': '复读 +1',
      'composer.placeholder': '说点什么…',
      'composer.addImage': '添加图片',
      'composer.uploading': '正在上传图片…',
      'mention.title': '提及用户',
      'mention.hint': '继续输入用户名进行搜索',
      'mention.empty': '没有匹配的用户',
      'composer.label': '消息输入框',
      messages: '聊天室消息',
      jump: '跳到最新消息',
      'plain.image': '图片',
      'redPacket.title': '红包',
      'redPacket.type.random': '拼手气红包',
      'redPacket.type.average': '普通红包',
      'redPacket.type.specify': '专属红包',
      'redPacket.type.heartbeat': '心跳红包',
      'redPacket.type.rockPaperScissors': '猜拳红包',
      'redPacket.from': '来自 {name}',
      'redPacket.progress': '{got}/{count} 已领取',
      'redPacket.pool': '奖池 {points} 积分',
      'redPacket.claims': '领取明细',
      'redPacket.noClaims': '还没有人领取',
      'redPacket.claim': '抢红包',
      'redPacket.claiming': '领取中…',
      'redPacket.finished': '红包已领完',
      'redPacket.legacy': '旧红包仅可查看领取记录，暂不支持在这里领取。',
      'redPacket.riskHeartbeat': '心跳红包可能领到负积分，领取前请确认积分余额充足。',
      'redPacket.riskRps': '猜拳红包可能扣除积分。请选择出拳并确认风险。',
      'redPacket.riskAccept': '我已知晓可能扣除积分',
      'redPacket.gesture': '出拳',
      'redPacket.rock': '石头',
      'redPacket.scissors': '剪刀',
      'redPacket.paper': '布',
      'redPacket.shortRock': '石',
      'redPacket.shortScissors': '剪',
      'redPacket.shortPaper': '布',
      'redPacket.close': '关闭',
      'redPacket.retry': '重试',
      'redPacket.own': '这是你发出的红包。',
      'redPacket.confirm': '确认领取',
      'redPacket.confirmRisk': '确认领取（可能扣除积分）',
      'redPacket.cardClaimed': '已领取',
      'redPacket.cardFinished': '已抢完',
      'user.title': '用户资料',
      'user.medals': '勋章',
      'user.points': '积分 {points}',
      'user.online': '累计在线 {minutes} 分钟',
      'user.number': '编号 {number}',
      'user.location': '位置 {city}',
      'user.home': '主页',
      'user.profileLink': '个人链接',
      'user.loadFailed': '用户资料加载失败',
      'user.close': '关闭',
      'redPacket.outcome.win': '赢',
      'redPacket.outcome.lose': '输',
      'redPacket.outcome.tie': '平局',

      'composer.send': '发送',
      'composer.sending': '发送中…',
      'error.network': '网络连接失败，请稍后重试。',
      'error.unauthorized': '登录已失效，请重新登录。',
      'error.credentials': '账号或密码错误。',
      'error.mfa': '需要两步验证码。',
      'error.captcha': '需要人机验证，请先在摸鱼派网页完成验证。',
      'error.forbidden': '当前账号没有权限（可能需要绑定手机）。',
      'error.points': '积分不足。',
      'error.rate': '操作过于频繁，请稍后再试。',
      'error.server': '摸鱼派服务暂时不可用。',
      'error.upload': '图片上传失败，请稍后重试。',
      'error.notRemovable': '这条消息不能撤回（红包等特殊消息不支持撤回）。',
      'error.notFound': '消息不存在或已被撤回。',
      'error.recallFailed': '撤回失败，请稍后重试。',
      'error.hostRestart': '插件 Host 还是旧版本，请完全退出 DSH 再重新打开。',
      'error.generic': '操作失败，请稍后重试。',
      'error.dismiss': '关闭',
      'card.redPacket': '红包',
      'card.redPacketMeta': '金额 {money} · {got}/{count} 已领取',
      'card.music': '音乐',
      'card.weather': '天气',
      'card.unavailable': '这条消息暂不可读',
      'system.join': '{name} 加入了聊天室',
      'system.leave': '{name} 离开了聊天室',
      'notify.title': '{name} · 摸鱼派',
    }

    const en = {
      nav: 'FishPi',
      tabTitle: 'FishPi',
      open: 'Open the FishPi chatroom',
      'guide.title': 'FishPi chatroom',
      'guide.description': 'Read and send FishPi chatroom messages in the right Sidebar',
      'day.today': 'Today',
      'day.yesterday': 'Yesterday',
      'status.connected': 'Connected',
      'status.connecting': 'Connecting',
      'status.disconnected': 'Offline',
      online: '{count} online',
      topic: 'Topic',
      refresh: 'Refresh',
      'loadOlder': 'Load earlier messages',
      loading: 'Loading…',
      empty: 'No messages yet. Say hello!',
      'login.title': 'Sign in to FishPi',
      'login.account': 'Username or email',
      'login.password': 'Password',
      'login.mfa': 'Two-step code (optional)',
      'login.remember': 'Stay signed in on this device',
      'login.submit': 'Sign in',
      'login.busy': 'Signing in…',
      'login.hint': 'The FishPi refresh credential is saved locally, so restarting DSH does not require another sign-in.',
      'login.register': 'Create account',
      'login.needMfa': 'This account uses two-step verification. Enter the code and try again.',
      logout: 'Sign out',
      'settings.title': 'FishPi chatroom',
      'settings.account': 'Account',
      'settings.loggedInAs': 'Signed in',
      'settings.display': 'Message display',
      'settings.display.hint': 'Rich text renders Markdown, images, and links; plain text shows the text only.',
      'settings.display.rich': 'Rich text',
      'settings.display.plain': 'Plain text',
      'settings.notifications': 'Desktop notifications',
      'settings.notifications.hint': 'Notify through the system when the chatroom is not in front.',
      'settings.notifications.denied': 'The browser denied notification permission.',
      'settings.notifications.unsupported': 'System notifications are unavailable here.',
      'error.crash': 'The chat panel failed to render',
      'host.restart': 'The plugin Host is still on an older build; recall and moderator recall are unavailable. Quit and reopen DSH completely.',
      'settings.update': 'Plugin updates',
      'settings.update.versions': 'Current {current} · {latest}',
      'settings.update.check': 'Check for updates',
      'settings.update.checking': 'Checking…',
      'settings.update.install': 'Install now',
      'settings.update.installing': 'Installing…',
      'message.actions': 'Message actions',
      'message.quoteShort': 'Q',
      'message.recallShort': 'R',
      'message.recallConfirmShort': 'C',
      'message.mentionShort': '@',
      'message.repeatShort': '+1',
      'message.quote': 'Quote this message',
      'message.recall': 'Recall this message (click again to confirm; may cost points)',
      'message.recallModerate': 'Recall this message (moderator action; click again to confirm)',
      'message.recallConfirm': 'Click again to confirm recall',
      'message.mention': 'Mention this message’s author in the composer',
      'message.repeat': 'Repeat +1',
      'composer.placeholder': 'Say something…',
      'composer.addImage': 'Add images',
      'composer.uploading': 'Uploading images…',
      'mention.title': 'Mention a user',
      'mention.hint': 'Keep typing a username to search',
      'mention.empty': 'No matching users',
      'composer.label': 'Message input',
      messages: 'Chat messages',
      jump: 'Jump to latest',
      'plain.image': 'Image',
      'redPacket.title': 'Red packet',
      'redPacket.type.random': 'Random red packet',
      'redPacket.type.average': 'Standard red packet',
      'redPacket.type.specify': 'Dedicated red packet',
      'redPacket.type.heartbeat': 'Heartbeat red packet',
      'redPacket.type.rockPaperScissors': 'Rock-paper-scissors red packet',
      'redPacket.from': 'From {name}',
      'redPacket.progress': '{got}/{count} claimed',
      'redPacket.pool': 'Pool {points} points',
      'redPacket.claims': 'Claims',
      'redPacket.noClaims': 'No claims yet',
      'redPacket.claim': 'Claim',
      'redPacket.claiming': 'Claiming…',
      'redPacket.finished': 'All claims are gone',
      'redPacket.legacy': 'This legacy red packet is view-only here.',
      'redPacket.riskHeartbeat': 'A heartbeat red packet can award negative points. Check your balance before claiming.',
      'redPacket.riskRps': 'A rock-paper-scissors red packet can cost points. Pick a gesture and accept the risk.',
      'redPacket.riskAccept': 'I understand this may cost points',
      'redPacket.gesture': 'Gesture',
      'redPacket.rock': 'Rock',
      'redPacket.scissors': 'Scissors',
      'redPacket.paper': 'Paper',
      'redPacket.shortRock': 'R',
      'redPacket.shortScissors': 'S',
      'redPacket.shortPaper': 'P',
      'redPacket.close': 'Close',
      'redPacket.retry': 'Retry',
      'redPacket.own': 'You sent this red packet.',
      'redPacket.confirm': 'Confirm claim',
      'redPacket.confirmRisk': 'Confirm claim (may cost points)',
      'redPacket.cardClaimed': 'Claimed',
      'redPacket.cardFinished': 'All claimed',
      'user.title': 'User profile',
      'user.medals': 'Medals',
      'user.points': '{points} points',
      'user.online': '{minutes} minutes online',
      'user.number': 'No. {number}',
      'user.location': 'Location {city}',
      'user.home': 'Home',
      'user.profileLink': 'Website',
      'user.loadFailed': 'Could not load the profile',
      'user.close': 'Close',
      'redPacket.outcome.win': 'Win',
      'redPacket.outcome.lose': 'Lose',
      'redPacket.outcome.tie': 'Tie',

      'composer.send': 'Send',
      'composer.sending': 'Sending…',
      'error.network': 'Network request failed. Try again.',
      'error.unauthorized': 'The session expired. Sign in again.',
      'error.credentials': 'Wrong username or password.',
      'error.mfa': 'A two-step code is required.',
      'error.captcha': 'FishPi requires a human-verification challenge. Complete it on the FishPi website first.',
      'error.forbidden': 'This account is not allowed to do that (a bound phone number may be required).',
      'error.points': 'Not enough points.',
      'error.rate': 'Too many requests. Wait a moment and try again.',
      'error.server': 'The FishPi service is temporarily unavailable.',
      'error.upload': 'Image upload failed. Try again.',
      'error.notRemovable': 'This message cannot be recalled (red packets and other special messages are excluded).',
      'error.notFound': 'The message no longer exists or was already recalled.',
      'error.recallFailed': 'Recall failed. Try again.',
      'error.hostRestart': 'The plugin Host is still on an older build. Quit and reopen DSH completely.',
      'error.generic': 'The operation failed. Try again.',
      'error.dismiss': 'Dismiss',
      'card.redPacket': 'Red packet',
      'card.redPacketMeta': '{money} points · {got}/{count} claimed',
      'card.music': 'Music',
      'card.weather': 'Weather',
      'card.unavailable': 'This message is not readable now',
      'system.join': '{name} joined the chatroom',
      'system.leave': '{name} left the chatroom',
      'notify.title': '{name} · FishPi',
    }

    /** @returns {string} a UUID for idempotent sends, with a fallback for old engines. */
    function uuid() {
      try {
        return globalThis.crypto.randomUUID()
      } catch {
        return `${Date.now()}-${Math.random().toString(16).slice(2)}`
      }
    }

    /** @returns {{mode: 'rich'|'plain', notifications: boolean}} stored display preferences. */
    function readPrefs() {
      const fallback = { mode: 'rich', notifications: false }
      try {
        const raw = localStorage.getItem(PREFS_KEY)
        if (raw === null) return fallback
        const parsed = JSON.parse(raw)
        return {
          mode: parsed?.mode === 'plain' ? 'plain' : 'rich',
          notifications: parsed?.notifications === true,
        }
      } catch {
        return fallback
      }
    }

    /** @param {{mode: 'rich'|'plain', notifications: boolean}} prefs - preferences to persist. */
    function writePrefs(prefs) {
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
      } catch {
        // Private browsing can refuse storage; the session still works.
      }
    }

    /** Local record of red packets this browser account has already claimed. */
    const CLAIMED_KEY_PREFIX = 'fishpi-chat.claimed.v1.'

    /** @param {string} userId - account id. @returns {string[]} claimed packet ids. */
    function readClaimed(userId) {
      try {
        const raw = localStorage.getItem(`${CLAIMED_KEY_PREFIX}${userId}`)
        if (raw === null) return []
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed.map(String) : []
      } catch {
        return []
      }
    }

    /** @param {string} userId - account id. @param {string[]} ids - claimed packet ids. */
    function writeClaimed(userId, ids) {
      if (userId === '') return
      try {
        localStorage.setItem(`${CLAIMED_KEY_PREFIX}${userId}`, JSON.stringify(ids))
      } catch {
        // Claim state is a display cache; the server remains authoritative.
      }
    }

    /**
     * @param {string} path - route below `api/fishpi/`.
     * @param {{ method?: string, body?: unknown, signal?: AbortSignal }} [options] - request shape.
     * @returns {Promise<any>}
     */
    async function call(path, options = {}) {
      /** @type {Record<string, string>} */
      const headers = { accept: 'application/json' }
      /** @type {RequestInit} */
      const init = { method: options.method ?? 'GET', headers, cache: 'no-store' }
      if (options.body !== undefined) {
        headers['content-type'] = 'application/json'
        init.body = JSON.stringify(options.body)
      }
      if (options.signal !== undefined) init.signal = options.signal
      else if (typeof AbortSignal.timeout === 'function') init.signal = AbortSignal.timeout(20_000)
      let response
      try {
        response = await fetch(`${API}/${path}`, init)
      } catch (error) {
        if (options.signal?.aborted === true) throw error
        const failure = new Error('network')
        failure.code = 'network'
        throw failure
      }
      let data = null
      try {
        data = await response.json()
      } catch {
        // The error below carries the status.
      }
      if (!response.ok || data?.ok === false) {
        const failure = new Error(typeof data?.message === 'string' ? data.message : `HTTP ${response.status}`)
        failure.code = typeof data?.code === 'string' ? data.code : `http_${response.status}`
        failure.status = response.status
        throw failure
      }
      return data ?? {}
    }

    /**
     * @param {number} ms - wait length.
     * @param {AbortSignal} signal - cancellation.
     * @returns {Promise<void>}
     */
    function sleep(ms, signal) {
      return new Promise(resolve => {
        if (signal.aborted) {
          resolve()
          return
        }
        const timer = setTimeout(() => {
          signal.removeEventListener('abort', onAbort)
          resolve()
        }, ms)
        const onAbort = () => {
          clearTimeout(timer)
          resolve()
        }
        signal.addEventListener('abort', onAbort, { once: true })
      })
    }

    /**
     * @param {unknown} raw - a Host-normalized message.
     * @returns {object|undefined}
     */
    function normalizeMessage(raw) {
      if (raw === null || typeof raw !== 'object') return undefined
      const source = /** @type {Record<string, any>} */ (raw)
      const id = source.id === undefined || source.id === null ? '' : String(source.id)
      if (id === '') return undefined
      const author = source.author !== null && typeof source.author === 'object' ? source.author : {}
      return {
        id,
        createdAt: Number(source.createdAt) || 0,
        type: typeof source.type === 'string' ? source.type : 'text',
        content: typeof source.content === 'string' ? source.content : '',
        contentHtml: typeof source.contentHtml === 'string' ? source.contentHtml : '',
        author: {
          id: author.id === undefined || author.id === null ? '' : String(author.id),
          userName: typeof author.userName === 'string' ? author.userName : '',
          userNickname: typeof author.userNickname === 'string' ? author.userNickname : '',
          userAvatarURL: typeof author.userAvatarURL === 'string' ? author.userAvatarURL : '',
        },
        client: typeof source.client === 'string' ? source.client : '',
        medals: Array.isArray(source.medals) ? source.medals : [],
        card: source.card !== null && typeof source.card === 'object' ? source.card : {},
        reactionsUnavailable: source.reactionsUnavailable === true,
      }
    }

    /**
     * @param {object|undefined} user - a user record.
     * @returns {string} `nickname(username)`, or whichever part exists.
     */
    function displayUser(user) {
      const nickname = typeof user?.userNickname === 'string' ? user.userNickname.trim() : ''
      const username = typeof user?.userName === 'string' ? user.userName.trim() : ''
      if (nickname !== '' && username !== '') return `${nickname}(${username})`
      return nickname || username || '—'
    }

    /**
     * @param {number} ms - timestamp.
     * @returns {string} local `HH:mm`.
     */
    function clock(ms) {
      if (!Number.isFinite(ms) || ms <= 0) return ''
      const date = new Date(ms)
      return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    }

    /**
     * @param {number} ms - timestamp.
     * @returns {string} a day bucket for separators.
     */
    function dayKey(ms) {
      const date = new Date(Number(ms) || 0)
      return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
    }

    /**
     * @param {number} ms - timestamp.
     * @param {Function} t - bound translate.
     * @returns {string} a localized date separator.
     */
    function dayLabel(ms, t) {
      const date = new Date(Number(ms) || 0)
      const today = new Date()
      const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
      if (dayKey(ms) === dayKey(today.getTime())) return t('day.today')
      if (dayKey(ms) === dayKey(yesterday.getTime())) return t('day.yesterday')
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    }

    /**
     * @param {string} html - server-sanitized HTML.
     * @returns {string} HTML whose links and images are hardened for an embedded panel.
     */
    const htmlCache = new Map()
    function prepareHtml(html, base) {
      if (html === '') return ''
      const cacheKey = `${base}\n${html}`
      const cached = htmlCache.get(cacheKey)
      if (cached !== undefined) return cached
      const origin = typeof base === 'string' && base !== '' ? base : 'https://fishpi.cn'
      const resolve = value => {
        try {
          const url = new URL(value, origin)
          return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : ''
        } catch {
          return ''
        }
      }
      let output = html
      try {
        const template = document.createElement('template')
        template.innerHTML = html
        for (const element of [...template.content.querySelectorAll('*')]) {
          for (const attribute of [...element.attributes]) {
            if (/^on/iu.test(attribute.name)) element.removeAttribute(attribute.name)
          }
          const tag = element.tagName.toLowerCase()
          if (['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'].includes(tag)) {
            element.remove()
            continue
          }
          if (tag === 'a') {
            const href = (element.getAttribute('href') ?? '').trim()
            if (/^(javascript|data|vbscript):/iu.test(href)) {
              element.removeAttribute('href')
            } else if (href !== '' && !href.startsWith('#')) {
              const resolved = resolve(href)
              if (resolved !== '') element.setAttribute('href', resolved)
              else element.removeAttribute('href')
            }
            element.setAttribute('target', '_blank')
            element.setAttribute('rel', 'noopener noreferrer')
          }
          if (tag === 'img') {
            const source = (element.getAttribute('src') ?? '').trim()
            const resolved = resolve(source)
            if (resolved === '') {
              element.remove()
              continue
            }
            element.setAttribute('src', resolved)
            element.setAttribute('loading', 'lazy')
            element.setAttribute('referrerpolicy', 'no-referrer')
          }
        }
        output = template.innerHTML
      } catch {
        output = html
      }
      if (htmlCache.size > 200) htmlCache.clear()
      htmlCache.set(cacheKey, output)
      return output
    }

    /**
     * @param {string} html - markup from the server.
     * @param {string} [imageLabel] - text substituted for each image.
     * @returns {string} its text content.
     */
    function plainFromHtml(html, imageLabel = '') {
      if (html === '') return ''
      try {
        const holder = document.createElement('div')
        holder.innerHTML = html
        if (imageLabel !== '') {
          for (const image of holder.querySelectorAll('img')) {
            image.replaceWith(document.createTextNode(imageLabel))
          }
        }
        return holder.textContent ?? ''
      } catch {
        return html
      }
    }

    /**
     * Replace Markdown and HTML image syntax with a plain text label, leaving
     * fenced and inline code untouched so copied code stays readable.
     * @param {string} text - Markdown source.
     * @param {string} label - text substituted for each image.
     * @returns {string} source with images labelled.
     */
    function replaceImages(text, label) {
      const replaceSegment = segment => segment
        .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/gu, label)
        .replace(/!\[[^\]]*\]\([^)]*\)/gu, label)
        .replace(/!\[[^\]]*\]\[[^\]]*\]/gu, label)
        .replace(/<img\b[^>]*>/giu, label)
      const code = /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/gu
      let output = ''
      let last = 0
      let match
      while ((match = code.exec(text)) !== null) {
        output += replaceSegment(text.slice(last, match.index)) + match[0]
        last = match.index + match[0].length
      }
      return output + replaceSegment(text.slice(last))
    }

    /**
     * @param {object} message - normalized message.
     * @param {Function} t - bound translate.
     * @returns {string} plain-mode text with image source replaced by a label.
     */
    function plainMessage(message, t) {
      const label = `[${t('plain.image')}]`
      if (message.content !== '') return replaceImages(message.content, label)
      return plainFromHtml(message.contentHtml, label)
    }

    /**
     * @param {object} message - normalized message.
     * @param {Function} t - bound translate.
     * @returns {string} one-line text for notifications and accessibility.
     */
    function messageSummary(message, t) {
      if (message.type === 'redPacket') {
        const card = message.card?.redPacket ?? message.card ?? {}
        return `${t('card.redPacket')} ${typeof card.message === 'string' ? card.message : ''}`.trim()
      }
      if (message.type === 'music') {
        const card = message.card?.music ?? message.card ?? {}
        return `${t('card.music')} ${typeof card.title === 'string' ? card.title : ''}`.trim()
      }
      if (message.type === 'weather') {
        const card = message.card?.weather ?? message.card ?? {}
        return `${t('card.weather')} ${typeof card.t === 'string' ? card.t : ''}`.trim()
      }
      if (message.type === 'unavailable') return t('card.unavailable')
      return replaceImages(message.content || plainFromHtml(message.contentHtml, `[${t('plain.image')}]`), `[${t('plain.image')}]`).slice(0, 160)
    }

    /**
     * @param {string} code - stable failure code.
     * @param {string|undefined} fallback - server text.
     * @param {Function} t - bound translate.
     * @returns {string}
     */
    function localizedError(code, fallback, t) {
      switch (code) {
        case 'network': return t('error.network')
        case 'unauthorized': return t('error.unauthorized')
        case 'invalid_credentials': return t('error.credentials')
        case 'mfa_required': return t('error.mfa')
        case 'captcha_required': return t('error.captcha')
        case 'forbidden': return t('error.forbidden')
        case 'insufficient_points': return t('error.points')
        case 'rate_limited': return t('error.rate')
        case 'upload_failed': return t('error.upload')
        case 'message_not_removable': return t('error.notRemovable')
        case 'http_404':
        case 'not_found': return t('error.notFound')
        case 'recall_failed': return t('error.recallFailed')
        case 'host_restart': return t('error.hostRestart')
        case 'realtime_unavailable':
        case 'internal':
        case 'http_500':
        case 'http_502':
        case 'http_503': return t('error.server')
        default: return fallback !== undefined && fallback !== '' ? fallback : t('error.generic')
      }
    }

    /**
     * Shared reactive state for the chat tab, the header button, and Settings.
     * The Host keeps the authoritative session; this store is a derived cache.
     * @param {Function} t - bound translate used for system lines and notifications.
     */
    function createStore(t) {
      let state = {
        loaded: false,
        ready: false,
        hostVersion: '',
        loggedIn: false,
        user: null,
        connection: 'disconnected',
        messages: [],
        hasMore: false,
        loadingMessages: false,
        loadingOlder: false,
        sending: false,
        recalling: false,
        uploadingImages: false,
        loggingIn: false,
        loginError: null,
        mfaRequired: false,
        topic: '',
        online: 0,
        onlineUsers: [],
        cursor: 0,
        unread: 0,
        chatVisible: false,
        error: null,
        update: null,
        checkingUpdate: false,
        installingUpdate: false,
        siteUrl: 'https://fishpi.cn',
        prefs: readPrefs(),
        redPacketId: null,
        redPacketGesture: null,
        redPacket: null,
        redPacketLoading: false,
        redPacketError: null,
        redPacketClaiming: false,
        redPacketClaim: null,
        claimedPacketIds: [],
        userInfoName: null,
        userInfo: null,
        userInfoMedals: [],
        userInfoLoading: false,
        userInfoError: null,
        medalIcons: {},
      }
      let disposed = false
      let controller = new AbortController()
      let started = false
      let claimedUserId = ''
      let redPacketSeq = 0
      let recallKey = { id: '', requestId: '' }
      const medalPending = new Set()
      const listeners = new Set()
      const store = {
        getSnapshot: () => state,
        subscribe: listener => {
          listeners.add(listener)
          return () => { listeners.delete(listener) }
        },
      }

      /**
       * @param {Partial<typeof state>} patch - state fields to replace.
       */
      function set(patch) {
        if (disposed) return
        state = { ...state, ...patch }
        for (const listener of [...listeners]) listener()
      }

      function trim(messages) {
        return messages.length > MAX_RETAINED ? messages.slice(messages.length - MAX_RETAINED) : messages
      }

      /**
       * @param {object[]} messages - current list.
       * @param {object} message - message to insert or replace.
       * @returns {object[]} sorted, deduplicated list.
       */
      function mergeOne(messages, message) {
        const index = messages.findIndex(item => item.id === message.id)
        if (index >= 0) {
          const next = messages.slice()
          next[index] = message
          return next
        }
        const next = [...messages, message]
        next.sort((left, right) => (left.createdAt - right.createdAt) || (Number(left.id) - Number(right.id)))
        return next
      }

      /**
       * @param {object} message - one normalized message.
       * @param {boolean} isNew - whether the event announces a new message.
       */
      function receive(message, isNew) {
        const existing = state.messages.findIndex(item => item.id === message.id)
        if (existing >= 0) {
          set({ messages: mergeOne(state.messages, message) })
          return
        }
        const own = message.author?.id !== undefined && message.author.id !== '' && message.author.id === state.user?.id
        const hidden = !state.chatVisible || document.hidden || !document.hasFocus()
        const next = mergeOne(state.messages, message)
        if (isNew && !own && hidden) {
          set({ messages: trim(next), unread: state.unread + 1 })
          notify(message)
          return
        }
        set({ messages: trim(next) })
      }

      /**
       * @param {object} message - new message.
       */
      function notify(message) {
        if (!state.prefs.notifications) return
        if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
        const author = displayUser(message.author)
        try {
          const notification = new Notification(t('notify.title', { name: author }), {
            body: messageSummary(message, t).slice(0, 140),
            tag: 'fishpi-chat',
            renotify: true,
          })
          notification.onclick = () => {
            window.focus()
            openChat()
            notification.close()
          }
        } catch {
          // A platform without a notification surface simply skips it.
        }
      }

      /**
       * @param {object} data - Host state payload.
       */
      function applyState(data) {
        const was = state.loggedIn
        const incoming = Number(data.cursor) || 0
        const restarted = state.cursor > 0 && incoming < state.cursor
        const nextUserId = data.user?.id === undefined || data.user?.id === null ? '' : String(data.user.id)
        const claimedPacketIds = nextUserId === claimedUserId
          ? state.claimedPacketIds
          : (nextUserId === '' ? [] : readClaimed(nextUserId))
        claimedUserId = nextUserId
        set({
          loaded: true,
          ready: data.ready === true,
          hostVersion: typeof data.hostVersion === 'string' ? data.hostVersion : '',
          loggedIn: data.loggedIn === true,
          user: data.user ?? null,
          connection: typeof data.connection === 'string' ? data.connection : state.connection,
          cursor: restarted ? incoming : Math.max(state.cursor, incoming),
          mfaRequired: data.mfaRequired === true,
          siteUrl: typeof data.siteUrl === 'string' && data.siteUrl !== '' ? data.siteUrl : state.siteUrl,
          error: data.error === undefined ? state.error : data.error,
          update: data.update === undefined ? state.update : data.update,
          claimedPacketIds,
        })
        if (was && !data.loggedIn) {
          set({
            messages: [],
            recalling: false,
            unread: 0,
            topic: '',
            online: 0,
            redPacketId: null,
            redPacketGesture: null,
            redPacket: null,
            redPacketError: null,
            redPacketClaiming: false,
            redPacketClaim: null,
            claimedPacketIds: [],
            userInfoName: null,
            userInfo: null,
            userInfoMedals: [],
            userInfoLoading: false,
            userInfoError: null,
            medalIcons: {},
          })
          claimedUserId = ''
        }
        if ((!was && data.loggedIn) || restarted) void syncAll()
      }

      /** @param {object} event - one Host event envelope. */
      function applyEvent(event) {
        if (event === null || typeof event !== 'object') return
        const data = event.data ?? {}
        switch (event.type) {
          case 'state': applyState(data); return
          case 'connection': {
            set({ connection: typeof data.state === 'string' ? data.state : state.connection })
            if (data.state === 'connected') void syncAll()
            return
          }
          case 'sync': {
            void syncAll()
            return
          }
          case 'message.created': {
            const message = normalizeMessage(data.message)
            if (message !== undefined) receive(message, true)
            return
          }
          case 'message.updated': {
            const message = normalizeMessage(data.message)
            if (message !== undefined) receive(message, false)
            return
          }
          case 'message.deleted': {
            const id = data.messageId === undefined ? '' : String(data.messageId)
            if (id !== '') set({ messages: state.messages.filter(message => message.id !== id) })
            return
          }
          case 'topic': {
            set({ topic: typeof data.text === 'string' ? data.text.slice(0, MAX_TOPIC) : '' })
            return
          }
          case 'presence': {
            const id = `presence-${data.id === undefined || data.id === '' ? Date.now() : data.id}`
            if (state.messages.some(message => message.id === id)) return
            const actor = data.actor ?? {}
            const name = displayUser(actor)
            const text = typeof data.text === 'string' && data.text !== ''
              ? data.text
              : (data.kind === 'leave' ? t('system.leave', { name }) : t('system.join', { name }))
            set({
              messages: trim([...state.messages, {
                id,
                type: 'system',
                createdAt: Number(data.createdAt) || Date.now(),
                text,
                author: {},
              }]),
            })
            return
          }
          default: return
        }
      }

      /** Reload the latest message window, topic, and online count. */
      async function syncAll() {
        if (disposed || !state.loggedIn) return
        if (syncAll.running) {
          syncAll.queued = true
          return
        }
        syncAll.running = true
        try {
          await Promise.all([loadLatest(), loadTopic(), loadOnline()])
        } finally {
          syncAll.running = false
          if (syncAll.queued) {
            syncAll.queued = false
            void syncAll()
          }
        }
      }
      syncAll.running = false
      syncAll.queued = false

      /**
       * Load the newest window. With an existing window the result is merged,
       * so a reconnect does not discard pages loaded with “Load earlier”.
       * @param {{ replace?: boolean }} [options] - true resets the window.
       */
      async function loadLatest(options = {}) {
        if (disposed || !state.loggedIn) return
        const replace = options.replace === true || state.messages.length === 0
        set({ loadingMessages: state.messages.length === 0 })
        try {
          const data = await call(`messages?size=${WINDOW_SIZE}`, { signal: controller.signal })
          const list = Array.isArray(data.list) ? data.list.map(normalizeMessage).filter(Boolean) : []
          const next = replace ? list : list.reduce((messages, message) => mergeOne(messages, message), state.messages)
          set({
            messages: trim(next),
            hasMore: replace ? data.hasMore === true : state.hasMore || data.hasMore === true,
            loadingMessages: false,
          })
        } catch (error) {
          if (!disposed) set({ loadingMessages: false, error: { code: error.code ?? 'generic', message: error.message } })
        }
      }

      /** Load the page before the oldest loaded message. */
      async function loadOlder() {
        const first = state.messages.find(message => message.type !== 'system')
        if (first === undefined || !state.hasMore || state.loadingOlder) return 0
        set({ loadingOlder: true })
        try {
          const data = await call(`messages?size=${WINDOW_SIZE}&before=${encodeURIComponent(first.id)}`, { signal: controller.signal })
          const older = Array.isArray(data.list) ? data.list.map(normalizeMessage).filter(Boolean) : []
          const known = new Set(state.messages.map(message => message.id))
          const fresh = older.filter(message => !known.has(message.id))
          const next = [...fresh, ...state.messages]
          next.sort((left, right) => (left.createdAt - right.createdAt) || (Number(left.id) - Number(right.id)))
          set({ messages: next, hasMore: data.hasMore === true, loadingOlder: false })
          return fresh.length
        } catch (error) {
          if (!disposed) set({ loadingOlder: false, error: { code: error.code ?? 'generic', message: error.message } })
          return 0
        }
      }

      /** Refresh the current topic. */
      async function loadTopic() {
        try {
          const data = await call('topic', { signal: controller.signal })
          if (!disposed) set({ topic: typeof data.text === 'string' ? data.text.slice(0, MAX_TOPIC) : '' })
        } catch {
          // A topic is secondary; the next sync retries it.
        }
      }

      /** Refresh the visible online count. */
      async function loadOnline() {
        try {
          const data = await call('online', { signal: controller.signal })
          if (!disposed) {
            set({
              online: Number(data.total) || 0,
              onlineUsers: Array.isArray(data.list)
                ? data.list.filter(user => user !== null && typeof user === 'object').slice(0, 50)
                : [],
            })
          }
        } catch {
          // The count is secondary; the next sync retries it.
        }
      }

      /**
       * @param {{ nameOrEmail: string, password: string, mfaCode?: string, remember: boolean }} input - login form.
       * @returns {Promise<{ok: boolean, code?: string, message?: string, mfaRequired?: boolean}>}
       */
      async function login(input) {
        set({ loggingIn: true, loginError: null })
        try {
          const data = await call('login', { method: 'POST', body: input })
          if (data.ok === false) {
            const failure = { ok: false, code: data.code, message: data.message, mfaRequired: data.mfaRequired === true }
            set({ loggingIn: false, loginError: failure, mfaRequired: failure.mfaRequired })
            return failure
          }
          const next = await call('state')
          set({
            loggingIn: false,
            loggedIn: true,
            user: data.user ?? next.user ?? null,
            messages: [],
            unread: 0,
            mfaRequired: false,
            loginError: null,
            error: null,
            cursor: Math.max(state.cursor, Number(next.cursor) || 0),
          })
          await syncAll()
          return { ok: true }
        } catch (error) {
          const failure = { ok: false, code: error.code, message: error.message }
          set({ loggingIn: false, loginError: failure })
          return failure
        }
      }

      /**
       * Forget the account in Settings.
       * @returns {Promise<{ok: boolean}>} whether the Host acknowledged the sign-out.
       */
      async function logout() {
        let ok = true
        try {
          await call('logout', { method: 'POST', body: {} })
        } catch (error) {
          ok = false
          set({ error: { code: error.code ?? 'generic', message: error.message } })
        }
        set({
          loggedIn: false,
          user: null,
          messages: [],
          recalling: false,
          unread: 0,
          topic: '',
          online: 0,
          onlineUsers: [],
          mfaRequired: false,
          redPacketId: null,
          redPacketGesture: null,
          redPacket: null,
          redPacketError: null,
          redPacketClaiming: false,
          redPacketClaim: null,
          claimedPacketIds: [],
          userInfoName: null,
          userInfo: null,
          userInfoMedals: [],
          userInfoLoading: false,
          userInfoError: null,
          medalIcons: {},
        })
        claimedUserId = ''
        return { ok }
      }

      /**
       * Resolve medal icons for message authors and merge them into the cache.
       * @param {object[]} messages - current message window.
       */
      async function loadMedalIcons(messages) {
        if (disposed || !state.loggedIn) return
        const names = [...new Set(messages
          .filter(message => message.author?.userName && Array.isArray(message.medals) && message.medals.length > 0)
          .map(message => message.author.userName))]
        const missing = names.filter(name => !(name in state.medalIcons) && !medalPending.has(name))
        if (missing.length === 0) return
        for (const name of missing) medalPending.add(name)
        try {
          const data = await call(`medals?names=${encodeURIComponent(missing.join(','))}`, { signal: controller.signal })
          const map = data.medals !== null && typeof data.medals === 'object' ? data.medals : {}
          const medalIcons = { ...state.medalIcons }
          for (const name of missing) medalIcons[name] = Array.isArray(map[name]) ? map[name] : []
          set({ medalIcons })
        } catch {
          const medalIcons = { ...state.medalIcons }
          for (const name of missing) medalIcons[name] = []
          set({ medalIcons })
        } finally {
          for (const name of missing) medalPending.delete(name)
        }
      }

      /**
       * Open one user's public profile and medal icons.
       * @param {string} userName - public username.
       */
      async function openUserInfo(userName) {
        const name = typeof userName === 'string' ? userName.trim() : ''
        if (name === '' || !/^[A-Za-z0-9_-]+$/u.test(name)) return
        set({
          userInfoName: name,
          userInfo: null,
          userInfoMedals: [],
          userInfoLoading: true,
          userInfoError: null,
        })
        try {
          const data = await call(`user?name=${encodeURIComponent(name)}`, { signal: controller.signal })
          if (state.userInfoName === name) {
            set({
              userInfo: data.profile ?? null,
              userInfoMedals: Array.isArray(data.medals) ? data.medals : [],
              userInfoLoading: false,
            })
          }
        } catch (error) {
          if (state.userInfoName === name) {
            set({
              userInfoLoading: false,
              userInfoError: { code: error.code ?? 'generic', message: error.message },
            })
          }
        }
      }

      /** Close the user profile dialog. */
      function closeUserInfo() {
        set({
          userInfoName: null,
          userInfo: null,
          userInfoMedals: [],
          userInfoLoading: false,
          userInfoError: null,
        })
      }

      /**
       * Search usernames for an `@` mention candidate list.
       * @param {string} prefix - text typed after `@`.
       * @returns {Promise<object[]>} matching users.
       */
      async function suggestUsers(prefix) {
        if (!state.loggedIn || prefix === '') return []
        try {
          const data = await call(`users?prefix=${encodeURIComponent(prefix)}`, { signal: controller.signal })
          return Array.isArray(data.list) ? data.list : []
        } catch {
          return []
        }
      }

      /**
       * Upload one or more images through the Host's authenticated upload route.
       * @param {FileList|File[]} files - images selected or pasted by the user.
       * @returns {Promise<{ok: boolean, files?: {name: string, url: string}[]}>}
       */
      async function uploadImages(files) {
        const images = [...files].filter(file => file !== null
          && typeof file === 'object'
          && typeof file.type === 'string'
          && file.type.startsWith('image/'))
        if (images.length === 0) return { ok: false }
        set({ uploadingImages: true, error: null })
        try {
          const form = new FormData()
          for (const file of images) form.append('file', file, file.name || 'image.png')
          /** @type {RequestInit} */
          const init = { method: 'POST', body: form, cache: 'no-store' }
          if (typeof AbortSignal.timeout === 'function') init.signal = AbortSignal.timeout(60_000)
          let response
          try {
            response = await fetch(`${API}/upload`, init)
          } catch (error) {
            const failure = new Error('network')
            failure.code = 'network'
            throw failure
          }
          let data = null
          try {
            data = await response.json()
          } catch {
            // The status carries the failure.
          }
          if (!response.ok || data?.ok === false) {
            const failure = new Error(typeof data?.message === 'string' ? data.message : `HTTP ${response.status}`)
            failure.code = typeof data?.code === 'string' ? data.code : `http_${response.status}`
            throw failure
          }
          const uploaded = Array.isArray(data.files)
            ? data.files.filter(file => file !== null && typeof file.url === 'string' && file.url !== '')
            : []
          set({ uploadingImages: false })
          return { ok: true, files: uploaded }
        } catch (error) {
          set({
            uploadingImages: false,
            error: { code: error.code ?? 'generic', message: error.message },
          })
          return { ok: false }
        }
      }

      /**
       * Recall one of the current account's messages.
       * @param {string} id - message id.
       * @returns {Promise<{ok: boolean}>} whether the Host withdrew the message.
       */
      async function recall(id) {
        if (state.recalling) return { ok: false }
        const clean = String(id)
        if (!/^\d+$/u.test(clean)) return { ok: false }
        if (recallKey.id !== clean) recallKey = { id: clean, requestId: uuid() }
        set({ recalling: true, error: null })
        try {
          await call('recall', { method: 'POST', body: { id: clean, requestId: recallKey.requestId } })
          recallKey = { id: '', requestId: '' }
          set({
            recalling: false,
            messages: state.messages.filter(message => message.id !== clean),
          })
          return { ok: true }
        } catch (error) {
          const code = error.code ?? 'generic'
          if ((code === 'http_404' || code === 'not_found') && state.hostVersion !== '') {
            // The message was already withdrawn (for example by another
            // client) but is still in this local window. Drop it instead of
            // surfacing a misleading failure.
            recallKey = { id: '', requestId: '' }
            set({
              recalling: false,
              messages: state.messages.filter(message => message.id !== clean),
              error: null,
            })
            return { ok: true, removed: true }
          }
          set({
            recalling: false,
            error: state.hostVersion === ''
              ? { code: 'host_restart', message: error.message }
              : { code, message: error.message },
          })
          return { ok: false }
        }
      }

      /**
       * @param {string} content - composer text.
       * @returns {Promise<{ok: boolean}>}
       */
      async function send(content) {
        if (!state.loggedIn) return { ok: false }
        set({ sending: true, error: null })
        try {
          const data = await call('send', { method: 'POST', body: { content, requestId: uuid() } })
          if (data.message !== null && data.message !== undefined) {
            const message = normalizeMessage(data.message)
            if (message !== undefined) set({ messages: trim(mergeOne(state.messages, message)) })
          }
          set({ sending: false })
          return { ok: true }
        } catch (error) {
          set({ sending: false, error: { code: error.code ?? 'generic', message: error.message } })
          return { ok: false }
        }
      }

      /**
       * @param {'rich'|'plain'} mode - message rendering mode.
       */
      function setMode(mode) {
        const prefs = { ...state.prefs, mode }
        writePrefs(prefs)
        set({ prefs })
      }

      /**
       * @param {boolean} notifications - desktop notification preference.
       */
      function setNotifications(notifications) {
        const prefs = { ...state.prefs, notifications }
        writePrefs(prefs)
        set({ prefs })
      }

      /**
       * @param {boolean} visible - whether a chat tab is on screen.
       */
      function setChatVisible(visible) {
        if (visible && state.unread > 0) set({ chatVisible: true, unread: 0 })
        else set({ chatVisible: visible })
      }

      /** Clear the unread count when the window and the chat tab are both visible. */
      function clearUnreadIfVisible() {
        if (state.chatVisible && state.unread > 0) set({ unread: 0 })
      }

      /** Clear the inline failure banner. */
      function clearError() {
        set({ error: null })
      }

      /**
       * Ask the Host to re-check npm and publish the result.
       * @returns {Promise<{ok: boolean}>} whether the check completed.
       */
      async function checkUpdate() {
        if (state.checkingUpdate) return { ok: false }
        set({ checkingUpdate: true })
        try {
          const data = await call('update/check', { method: 'POST', body: {} })
          set({
            checkingUpdate: false,
            update: data.update === undefined ? state.update : data.update,
          })
          return { ok: true }
        } catch (error) {
          set({
            checkingUpdate: false,
            update: {
              ...(state.update ?? {
                current: '',
                latest: '',
                available: false,
                localAhead: false,
                url: '',
                source: '',
                checkedAt: 0,
              }),
              checkedAt: Date.now(),
              error: { code: error.code ?? 'generic', message: error.message },
            },
          })
          return { ok: false }
        }
      }

      /** Install the available npm update through the Host plugin manager. */
      async function installUpdate() {
        if (state.installingUpdate) return { ok: false }
        set({ installingUpdate: true, error: null })
        try {
          await call('update/install', { method: 'POST', body: {} })
          set({
            installingUpdate: false,
            update: state.update === null ? state.update : { ...state.update, available: false },
          })
          window.setTimeout(() => { window.location.reload() }, 300)
          return { ok: true }
        } catch (error) {
          set({
            installingUpdate: false,
            error: { code: error.code ?? 'generic', message: error.message },
          })
          return { ok: false }
        }
      }

      /**
       * Open one red packet's detail and claim records.
       * @param {string} id - message id.
       * @param {number|null} [gesture] - a gesture picked on the card, preselected in the dialog.
       */
      async function openRedPacket(id, gesture = null) {
        const clean = String(id)
        const seq = ++redPacketSeq
        set({
          redPacketId: clean,
          redPacketGesture: Number.isInteger(gesture) ? gesture : null,
          redPacket: null,
          redPacketError: null,
          redPacketLoading: true,
          redPacketClaim: null,
        })
        try {
          const data = await call(`red-packet?id=${encodeURIComponent(clean)}`, { signal: controller.signal })
          if (state.redPacketId === clean && seq === redPacketSeq) {
            set({ redPacket: data.detail ?? null, redPacketLoading: false })
          }
        } catch (error) {
          if (state.redPacketId === clean && seq === redPacketSeq) {
            set({
              redPacketLoading: false,
              redPacketError: { code: error.code ?? 'generic', message: error.message },
            })
          }
        }
      }

      /** Close the red-packet dialog. */
      function closeRedPacket() {
        set({
          redPacketId: null,
          redPacketGesture: null,
          redPacket: null,
          redPacketError: null,
          redPacketLoading: false,
          redPacketClaiming: false,
          redPacketClaim: null,
        })
      }

      /**
       * Claim the open red packet after the user explicitly accepts any risk.
       * @param {{ gesture?: number, riskAccepted?: boolean }} options - RPS gesture and risk acknowledgement.
       * @returns {Promise<{ok: boolean}>}
       */
      async function claimRedPacket(options = {}, packetId = state.redPacketId) {
        const id = packetId === null || packetId === undefined ? null : String(packetId)
        if (id === null) return { ok: false }
        const dialogOpen = state.redPacketId === id
        set(dialogOpen
          ? { redPacketClaiming: true, redPacketError: null }
          : { redPacketClaiming: true })
        try {
          const data = await call('red-packet/claim', {
            method: 'POST',
            body: {
              id,
              requestId: uuid(),
              gesture: Number.isInteger(options.gesture) ? options.gesture : undefined,
              riskAccepted: options.riskAccepted === true,
            },
          })
          const claimedPacketIds = [...new Set([...state.claimedPacketIds, id])]
          writeClaimed(claimedUserId, claimedPacketIds)
          if (state.redPacketId === id) {
            redPacketSeq += 1
            set({
              redPacketClaiming: false,
              redPacketClaim: data.claim ?? null,
              redPacket: data.detail ?? state.redPacket,
              redPacketLoading: false,
              claimedPacketIds,
            })
          } else {
            set({ redPacketClaiming: false, claimedPacketIds })
          }
          return { ok: true, claim: data.claim ?? null }
        } catch (error) {
          if (state.redPacketId === id) {
            redPacketSeq += 1
            set({
              redPacketClaiming: false,
              redPacketLoading: false,
              redPacketError: { code: error.code ?? 'generic', message: error.message },
            })
          } else {
            set({
              redPacketClaiming: false,
              error: { code: error.code ?? 'generic', message: error.message },
            })
          }
          return { ok: false }
        }
      }

      /** @returns {boolean} whether the Host routes are reachable. */
      function reachable() {
        return state.loaded
      }

      /** Read the initial state and start the long-poll event loop. */
      async function init(signal) {
        if (started) return
        started = true
        controller = new AbortController()
        signal.addEventListener('abort', () => controller.abort(), { once: true })
        try {
          const data = await call('state', { signal: controller.signal })
          applyState(data)
          if (data.loggedIn === true) await syncAll()
        } catch (error) {
          if (!disposed) set({ loaded: true, error: { code: error.code ?? 'generic', message: error.message } })
        }
        void eventLoop(controller.signal)
      }

      /**
       * @param {AbortSignal} signal - module lifetime.
       */
      async function eventLoop(signal) {
        let failures = 0
        while (!disposed && !signal.aborted) {
          const since = state.cursor
          try {
            const data = await call(`events?since=${since}`, { signal })
            failures = 0
            if (data.reset === true) {
              set({ cursor: Number(data.cursor) || 0 })
              await syncAll()
              continue
            }
            if (Array.isArray(data.events) && data.events.length > 0) {
              for (const event of data.events) applyEvent(event)
            }
            if (Number.isFinite(Number(data.cursor))) {
              set({ cursor: Math.max(state.cursor, Number(data.cursor)) })
            }
          } catch (error) {
            if (disposed || signal.aborted) return
            failures += 1
            await sleep(Math.min(10_000, 1_000 * 2 ** Math.min(failures, 4)), signal)
          }
        }
      }

      /** Stop all requests and stop publishing. */
      function dispose() {
        disposed = true
        controller.abort()
        listeners.clear()
      }

      Object.assign(store, {
        init,
        dispose,
        login,
        logout,
        send,
        recall,
        suggestUsers,
        openUserInfo,
        closeUserInfo,
        loadMedalIcons,
        uploadImages,
        loadOlder,
        loadTopic,
        loadOnline,
        syncAll,
        setMode,
        setNotifications,
        setChatVisible,
        clearUnreadIfVisible,
        clearError,
        checkUpdate,
        installUpdate,
        openRedPacket,
        closeRedPacket,
        claimRedPacket,
        reachable,
      })
      return store
    }

    const LOGO_ASSETS = new Map((LOGO_ANIMATION.assets ?? []).map(asset => [asset.id, asset]))
    const LOGO_LAYERS = [...(LOGO_ANIMATION.layers ?? [])].reverse()
    const LOGO_WIDTH = Number(LOGO_ANIMATION.w) || 800
    const LOGO_HEIGHT = Number(LOGO_ANIMATION.h) || 800
    const LOGO_FPS = Number(LOGO_ANIMATION.fr) || 25
    const LOGO_FRAMES = Number(LOGO_ANIMATION.op) || 75
    /** The site starts this composition at frame 27, where the mark is visible. */
    const LOGO_START = 27
    const LOGO_SPAN = Math.max(1, LOGO_FRAMES - LOGO_START)

    /**
     * Evaluate one Lottie property at a frame. The composition only animates
     * image-layer transforms, so linear interpolation between keyframes is
     * enough to reproduce it without a full Lottie player.
     * @param {object|undefined} property - Lottie property.
     * @param {number} frame - frame in `0..op`.
     * @returns {any} the raw value at that frame.
     */
    function lottieValue(property, frame) {
      if (property === undefined || property === null) return undefined
      if (property.a !== 1 || !Array.isArray(property.k)) return property.k
      const keys = property.k
      if (keys.length === 0) return undefined
      if (frame <= keys[0].t) return keys[0].s
      for (let index = 0; index < keys.length - 1; index += 1) {
        const left = keys[index]
        const right = keys[index + 1]
        if (frame >= left.t && frame < right.t) {
          const end = left.e ?? right.s
          const ratio = (frame - left.t) / Math.max(1, right.t - left.t)
          if (Array.isArray(left.s) && Array.isArray(end)) {
            return left.s.map((value, item) => value + (end[item] - value) * ratio)
          }
          return left.s + (end - left.s) * ratio
        }
      }
      const last = keys[keys.length - 1]
      return last.e ?? last.s
    }

    /**
     * The FishPi home-page `#logo-animate` composition, replayed as three
     * positioned image layers. It animates only while mounted, and holds the
     * site's frame 27 for reduced motion.
     * @param {{size?: number}} props - square edge in pixels.
     */
    function AnimatedFishPiLogo({ size = 18 }) {
      const layerRefs = useRef([])

      useEffect(() => {
        const images = layerRefs.current
        const unit = size / LOGO_WIDTH
        const apply = frame => {
          LOGO_LAYERS.forEach((layer, index) => {
            const image = images[index]
            if (image === null || image === undefined) return
            const visible = frame >= (layer.ip ?? 0) && frame < (layer.op ?? LOGO_FRAMES)
            const asset = LOGO_ASSETS.get(layer.refId)
            if (!visible || asset === undefined) {
              image.style.opacity = '0'
              return
            }
            const anchor = lottieValue(layer.ks?.a, frame) ?? [0, 0]
            const position = lottieValue(layer.ks?.p, frame) ?? [0, 0]
            const scale = lottieValue(layer.ks?.s, frame) ?? [100, 100]
            const rotation = Number(lottieValue(layer.ks?.r, frame)) || 0
            const opacity = Number(lottieValue(layer.ks?.o, frame)) || 0
            const scaleX = (Number(scale[0]) || 100) / 100 * unit
            const scaleY = (Number(scale[1]) || 100) / 100 * unit
            const anchorX = (Number(anchor[0]) || 0) * scaleX
            const anchorY = (Number(anchor[1]) || 0) * scaleY
            image.style.width = `${asset.w * scaleX}px`
            image.style.height = `${asset.h * scaleY}px`
            image.style.left = `${(Number(position[0]) || 0) * unit - anchorX}px`
            image.style.top = `${(Number(position[1]) || 0) * unit - anchorY}px`
            image.style.transformOrigin = `${anchorX}px ${anchorY}px`
            image.style.transform = `rotate(${rotation}deg)`
            image.style.opacity = String(Math.max(0, Math.min(1, opacity / 100)))
          })
        }

        const media = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
          ? window.matchMedia('(prefers-reduced-motion: reduce)')
          : undefined
        if (media?.matches === true) {
          apply(LOGO_START)
          return undefined
        }
        let frameHandle
        let started
        const tick = now => {
          if (started === undefined) started = now
          apply(LOGO_START + ((now - started) / 1000 * LOGO_FPS) % LOGO_SPAN)
          frameHandle = requestAnimationFrame(tick)
        }
        frameHandle = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(frameHandle)
      }, [size])

      return h('span', {
        'aria-hidden': 'true',
        style: {
          position: 'relative',
          display: 'inline-block',
          flex: 'none',
          width: size,
          height: size,
          pointerEvents: 'none',
          verticalAlign: 'middle',
        },
      }, LOGO_LAYERS.map((layer, index) => {
        const asset = LOGO_ASSETS.get(layer.refId)
        if (asset === undefined) return null
        return h('img', {
          key: `${layer.ind ?? index}`,
          src: asset.p,
          alt: '',
          draggable: false,
          ref: element => { layerRefs.current[index] = element },
          style: {
            position: 'absolute',
            left: 0,
            top: 0,
            maxWidth: 'none',
            maxHeight: 'none',
            pointerEvents: 'none',
            userSelect: 'none',
            opacity: 0,
          },
        })
      }))
    }

    /** @param {object} props - `{size}` from the slot or a direct call. */
    function IconFish({ size = 18 }) {
      return h(AnimatedFishPiLogo, { size })
    }

    /** The same fish mark for the settings navigation. */
    function SettingsIcon({ size = 16 }) {
      return h(IconFish, { size })
    }

    /**
     * @param {{url: string, name: string, size?: number}} props - avatar source and fallback initial.
     */
    function Avatar({ url, name, size = 28 }) {
      const [failed, setFailed] = useState(false)
      useEffect(() => { setFailed(false) }, [url])
      if (url === '' || failed) {
        return h('span', {
          className: 'fc-avatar fc-avatar-fallback',
          style: { width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.42)) },
          'aria-hidden': 'true',
        }, (name || '?').slice(0, 1).toUpperCase())
      }
      return h('img', {
        className: 'fc-avatar',
        src: url,
        width: size,
        height: size,
        alt: '',
        loading: 'lazy',
        referrerPolicy: 'no-referrer',
        onError: () => setFailed(true),
      })
    }

    /** @param {{state: string, t: Function}} props - transport state and copy. */
    function StatusDot({ state, t }) {
      const label = state === 'connected' ? t('status.connected') : state === 'connecting' ? t('status.connecting') : t('status.disconnected')
      return h('span', { className: `fc-status fc-status-${state}`, title: label, 'aria-label': label })
    }

    /**
     * One red-packet card: type, progress, optional explicit confirmation, and
     * a direct claim. A checked confirmation makes a click claim; without it
     * the card opens the detail dialog.
     * @param {{message: object, card: object, t: Function}} props - message, card payload, copy.
     */
    function RedPacketCard({ message, card, t }) {
      const store = sharedStore
      const state = useStore()
      const [confirmed, setConfirmed] = useState(false)
      const id = String(message.id)
      const type = typeof card.type === 'string' ? card.type : ''
      const typeLabel = redPacketTypeLabel(t, type)
      const isRps = type === 'rockPaperScissors'
      const risky = type === 'heartbeat' || isRps
      const count = Number(card.count) || 0
      const got = Number(card.got) || 0
      const finished = count > 0 && got >= count
      const claimed = state.claimedPacketIds.includes(id)
      const own = message.author?.id !== undefined
        && String(message.author.id) === (state.user?.id ?? '')
      const ownBlocked = own && type !== 'heartbeat'
      const blocked = claimed || finished || ownBlocked
      const busy = state.redPacketClaiming
      const progress = t('card.redPacketMeta', {
        money: card.money ?? '-',
        got: card.got ?? 0,
        count: card.count ?? '-',
      })

      const claim = async gesture => {
        if (blocked || busy) return
        if (isRps) {
          if (!Number.isInteger(gesture)) {
            void store.openRedPacket(id)
            return
          }
        } else if (!confirmed) {
          void store.openRedPacket(id)
          return
        }
        // Open the result dialog immediately; it shows the claim outcome or
        // failure as soon as the request settles.
        void store.openRedPacket(id, Number.isInteger(gesture) ? gesture : null)
        await store.claimRedPacket({
          riskAccepted: risky,
          gesture: Number.isInteger(gesture) ? gesture : undefined,
        }, id)
      }

      const onCardClick = () => {
        if (blocked) {
          void store.openRedPacket(id)
          return
        }
        void claim(null)
      }

      return h('div', {
        className: `fc-card fc-card-redpacket fc-card-button${blocked ? ' fc-card-blocked' : ''}`,
        role: 'button',
        tabIndex: 0,
        'aria-label': `${typeLabel}: ${progress}`,
        onClick: onCardClick,
        onKeyDown: event => {
          if (event.target !== event.currentTarget) return
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onCardClick()
          }
        },
      },
        h('div', { className: 'fc-card-title' }, typeLabel),
        typeof card.message === 'string' && card.message !== ''
          ? h('div', { className: 'fc-card-body' }, card.message)
          : null,
        h('div', { className: 'fc-card-meta' }, progress),
        blocked
          ? h('div', { className: 'fc-card-state' },
              claimed
                ? t('redPacket.cardClaimed')
                : ownBlocked
                  ? t('redPacket.own')
                  : t('redPacket.cardFinished'))
          : h('div', { className: 'fc-card-controls' },
              isRps
                ? h('div', { className: 'fc-gesture-row', role: 'group', 'aria-label': t('redPacket.gesture') },
                    [[0, 'redPacket.shortRock', 'redPacket.rock'], [1, 'redPacket.shortScissors', 'redPacket.scissors'], [2, 'redPacket.shortPaper', 'redPacket.paper']].map(([value, shortKey, fullKey]) =>
                      h('button', {
                        key: value,
                        type: 'button',
                        className: 'fc-gesture-button',
                        title: t(fullKey),
                        'aria-label': t(fullKey),
                        disabled: busy,
                        onClick: event => {
                          event.stopPropagation()
                          void claim(value)
                        },
                      }, t(shortKey)),
                    ),
                  )
                : h('label', { className: 'fc-card-check', onClick: event => event.stopPropagation() },
                    h('input', {
                      type: 'checkbox',
                      checked: confirmed,
                      disabled: busy,
                      onChange: event => setConfirmed(event.target.checked),
                    }),
                    h('span', null, risky ? t('redPacket.confirmRisk') : t('redPacket.confirm')),
                  ),
            ),
      )
    }

    /**
     * @param {{message: object, mode: 'rich'|'plain', t: Function}} props - one message body.
     */
    function MessageContent({ message, mode, t, siteUrl }) {
      if (message.type === 'unavailable') {
        return h('div', { className: 'fc-unavailable' }, t('card.unavailable'))
      }
      if (message.type === 'redPacket') {
        const card = message.card?.redPacket ?? message.card ?? {}
        return h(RedPacketCard, { message, card, t })
      }
      if (mode === 'plain') {
        return h('div', { className: 'fc-plain' }, message.type === 'text'
          ? plainMessage(message, t)
          : messageSummary(message, t))
      }
      if (message.type === 'music') {
        const card = message.card?.music ?? message.card ?? {}
        return h('div', { className: 'fc-card fc-card-music' },
          h('div', { className: 'fc-card-title' }, t('card.music')),
          typeof card.title === 'string' && card.title !== '' ? h('div', { className: 'fc-card-body' }, card.title) : null,
          typeof card.from === 'string' && card.from !== '' ? h('div', { className: 'fc-card-meta' }, card.from) : null,
        )
      }
      if (message.type === 'weather') {
        const card = message.card?.weather ?? message.card ?? {}
        const first = value => typeof value === 'string' ? value.split(',')[0] : ''
        const description = first(card.st)
        const low = first(card.min)
        const high = first(card.max)
        const range = low !== '' && high !== '' ? `${low}~${high}` : ''
        return h('div', { className: 'fc-card fc-card-weather' },
          h('div', { className: 'fc-card-title' }, t('card.weather')),
          h('div', { className: 'fc-card-body' }, [first(card.date), description].filter(Boolean).join(' ')),
          h('div', { className: 'fc-card-meta' }, [range, typeof card.t === 'string' ? card.t : ''].filter(Boolean).join(' · ')),
        )
      }
      if (message.contentHtml !== '') {
        return h('div', {
          className: 'fc-html',
          dangerouslySetInnerHTML: { __html: prepareHtml(message.contentHtml, siteUrl) },
        })
      }
      return h('div', { className: 'fc-plain' }, message.content)
    }

    /**
     * A run of identical messages, rendered as whole cards where each card
     * overlaps the previous one. The front (latest) card keeps the body and
     * actions; the earlier cards keep their avatar/name header visible.
     * @param {{messages: object[], mode: string, t: Function, siteUrl: string, actions: object|null}} props - the folded run.
     */
    function MessageStack({ messages, mode, t, siteUrl, actions, medalIcons }) {
      const offset = 33
      return h('div', { className: 'fc-msg-stack-row' },
        h('div', {
          className: 'fc-msg-stack',
          style: { paddingTop: `${(messages.length - 1) * offset}px` },
        },
          messages.map((message, index) => {
            const front = index === messages.length - 1
            return h('div', {
              key: message.id,
              className: `fc-stack-card${front ? ' fc-stack-card-front' : ''}`,
              style: front
                ? { zIndex: index + 1 }
                : { top: `${index * offset}px`, zIndex: index + 1 },
            },
              h(MessageRow, {
                message,
                own: false,
                grouped: false,
                mode,
                t,
                siteUrl,
                medalIcons: medalIcons[message.author?.userName ?? ''] ?? [],
                actions: front ? actions : null,
              }),
            )
          }),
        ),
      )
    }

    /**
     * @param {{message: object, own: boolean, grouped: boolean, mode: string, t: Function}} props - one row.
     */
    function MessageRow({ message, own, grouped, mode, t, siteUrl, medalIcons = [], actions = null }) {
      if (message.type === 'system') {
        return h('div', { className: 'fc-system' }, message.text)
      }
      const author = message.author ?? {}
      const name = displayUser(author)
      const avatarName = author.userNickname || author.userName || ''
      const medals = Array.isArray(message.medals) ? message.medals : []
      const resolvedMedals = medals
        .map(medal => {
          const icon = Array.isArray(medalIcons)
            ? medalIcons.find(entry => (medal.id !== '' && entry.id === medal.id) || (medal.name !== '' && entry.name === medal.name))
            : undefined
          return icon?.url ? { ...medal, url: icon.url } : null
        })
        .filter(Boolean)
      const avatar = h(Avatar, { url: author.userAvatarURL ?? '', name: avatarName })
      return h('div', { className: `fc-msg-line${grouped ? ' fc-grouped' : ''}` },
        h('div', { className: `fc-msg${own ? ' fc-own' : ''}${grouped ? ' fc-grouped' : ''}` },
          grouped
            ? h('span', { className: 'fc-avatar-spacer' })
            : author.userName !== ''
              ? h('button', {
                  type: 'button',
                  className: 'fc-avatar-button',
                  'aria-label': name,
                  onClick: () => { void sharedStore.openUserInfo(author.userName) },
                }, avatar)
              : avatar,
          h('div', { className: 'fc-msg-body' },
            grouped
              ? null
              : h('div', { className: 'fc-msg-head' },
                  author.userName !== ''
                    ? h('button', {
                        type: 'button',
                        className: 'fc-msg-name fc-user-link',
                        onClick: () => { void sharedStore.openUserInfo(author.userName) },
                      }, name)
                    : h('span', { className: 'fc-msg-name' }, name),
                  resolvedMedals.length > 0
                    ? h('span', { className: 'fc-msg-medals' },
                        resolvedMedals.map((medal, index) => h('img', {
                          key: medal.id || medal.name || index,
                          className: 'fc-msg-medal',
                          src: medal.url,
                          alt: medal.name,
                          title: [medal.name, medal.description].filter(Boolean).join(' · '),
                          loading: 'lazy',
                          referrerPolicy: 'no-referrer',
                          onError: event => { event.currentTarget.style.display = 'none' },
                        })),
                      )
                    : null,
                  h('time', { className: 'fc-msg-time', dateTime: new Date(message.createdAt).toISOString() }, clock(message.createdAt)),
                ),
            h('div', { className: 'fc-msg-content-row' },
              h('div', { className: 'fc-msg-content' }, h(MessageContent, { message, mode, t, siteUrl })),
              actions,
            ),
          ),
        ),
      )
    }

    /**
     * @param {{t: Function, compact?: boolean, onDone?: Function}} props - login form.
     */
    function LoginForm({ t, compact = false, onDone }) {
      const store = sharedStore
      const state = useStore()
      const id = React.useId()
      const [nameOrEmail, setNameOrEmail] = useState('')
      const [password, setPassword] = useState('')
      const [mfaCode, setMfaCode] = useState('')
      const [remember, setRemember] = useState(true)
      const [busy, setBusy] = useState(false)
      const [error, setError] = useState(null)
      const promptedMfa = state.mfaRequired || error?.mfaRequired === true

      /**
       * @param {SubmitEvent} event - form submit.
       */
      const submit = async event => {
        event.preventDefault()
        if (busy) return
        setBusy(true)
        setError(null)
        const result = await store.login({ nameOrEmail, password, mfaCode, remember })
        setBusy(false)
        if (result.ok) {
          setPassword('')
          onDone?.()
          return
        }
        setError(result)
      }

      return h('form', { className: `fc-login${compact ? ' fc-login-compact' : ''}`, onSubmit: submit },
        h('div', { className: 'fc-field' },
          h('label', { className: 'fc-label', htmlFor: `${id}-account` }, t('login.account')),
          h('input', {
            id: `${id}-account`,
            className: 'fc-input',
            value: nameOrEmail,
            autoComplete: 'username',
            onChange: event => setNameOrEmail(event.target.value),
          }),
        ),
        h('div', { className: 'fc-field' },
          h('label', { className: 'fc-label', htmlFor: `${id}-password` }, t('login.password')),
          h('input', {
            id: `${id}-password`,
            className: 'fc-input',
            type: 'password',
            value: password,
            autoComplete: 'current-password',
            onChange: event => setPassword(event.target.value),
          }),
        ),
        h('div', { className: 'fc-field' },
          h('label', { className: 'fc-label', htmlFor: `${id}-mfa` }, t('login.mfa')),
          h('input', {
            id: `${id}-mfa`,
            className: 'fc-input',
            value: mfaCode,
            inputMode: 'numeric',
            autoComplete: 'one-time-code',
            placeholder: t('login.mfa'),
            onChange: event => setMfaCode(event.target.value),
          }),
          promptedMfa ? h('p', { className: 'fc-hint' }, t('login.needMfa')) : null,
        ),
        h('label', { className: 'fc-check' },
          h('input', {
            type: 'checkbox',
            checked: remember,
            onChange: event => setRemember(event.target.checked),
          }),
          h('span', null, t('login.remember')),
        ),
        error === null
          ? null
          : h('p', { className: 'fc-error', role: 'alert' }, localizedError(error.code, error.message, t)),
        h('div', { className: 'fc-login-actions' },
          h('button', { className: 'fc-button fc-button-primary', type: 'submit', disabled: busy || nameOrEmail === '' || password === '' },
            busy ? t('login.busy') : t('login.submit'),
          ),
          h('a', {
            className: 'fc-button fc-register',
            href: REGISTER_URL,
            target: '_blank',
            rel: 'noopener noreferrer',
          }, t('login.register')),
        ),
        compact ? null : h('p', { className: 'fc-hint' }, t('login.hint')),
      )
    }

    /**
     * @param {{t: Function}} props - account card.
     */
    function AccountCard({ t }) {
      const store = sharedStore
      const state = useStore()
      const [busy, setBusy] = useState(false)
      if (!state.loggedIn) {
        return h('div', { className: 'fc-panel' },
          h('p', { className: 'fc-hint' }, t('login.hint')),
          h(LoginForm, { t }),
        )
      }
      const name = displayUser(state.user)
      const avatarName = state.user?.userNickname || state.user?.userName || ''
      return h('div', { className: 'fc-panel fc-account' },
        h(Avatar, { url: state.user?.userAvatarURL ?? '', name: avatarName, size: 36 }),
        h('div', { className: 'fc-account-body' },
          h('div', { className: 'fc-account-name' }, name),
        ),
        h('button', {
          className: 'fc-button',
          type: 'button',
          disabled: busy,
          onClick: async () => {
            setBusy(true)
            await store.logout()
            setBusy(false)
          },
        }, t('logout')),
      )
    }

    /**
     * @param {Function} t - bound translate.
     * @param {object|null|undefined} update - Host update state.
     * @returns {string} current and npm versions, nothing else.
     */
    function updateVersions(t, update) {
      const current = typeof update?.current === 'string' && update.current !== '' ? update.current : '—'
      const latest = typeof update?.latest === 'string' && update.latest !== '' ? update.latest : '—'
      return t('settings.update.versions', { current, latest })
    }

    /**
     * @param {{t: Function}} props - the Settings section page.
     */
    function SettingsSection({ t }) {
      const store = sharedStore
      const state = useStore()
      const [notificationError, setNotificationError] = useState(false)
      const supported = typeof Notification !== 'undefined'

      const toggleNotifications = async () => {
        setNotificationError(false)
        if (state.prefs.notifications) {
          store.setNotifications(false)
          return
        }
        if (!supported) {
          setNotificationError(true)
          return
        }
        try {
          let permission = Notification.permission
          if (permission === 'default') permission = await Notification.requestPermission()
          if (permission !== 'granted') {
            setNotificationError(true)
            store.setNotifications(false)
            return
          }
          store.setNotifications(true)
        } catch {
          setNotificationError(true)
          store.setNotifications(false)
        }
      }

      return h('div', { className: 'fc-settings' },
        h(Style),
        state.error === null
          ? null
          : h('div', { className: 'fc-banner', role: 'alert' },
              h('span', null, localizedError(state.error.code, state.error.message, t)),
              h('button', {
                type: 'button',
                className: 'fc-icon-button',
                'aria-label': t('error.dismiss'),
                title: t('error.dismiss'),
                onClick: () => store.clearError(),
              }, '×'),
            ),
        state.ready && state.hostVersion === ''
          ? h('div', { className: 'fc-banner', role: 'alert' }, h('span', null, t('host.restart')))
          : null,
        h('section', { className: 'fc-section' },
          h('h2', { className: 'fc-section-title' }, t('settings.account')),
          h(AccountCard, { t }),
        ),
        h('section', { className: 'fc-section' },
          h('h2', { className: 'fc-section-title' }, t('settings.display')),
          h('p', { className: 'fc-hint' }, t('settings.display.hint')),
          h('div', { className: 'fc-segmented', role: 'group', 'aria-label': t('settings.display') },
            h('button', {
              type: 'button',
              className: `fc-segment${state.prefs.mode === 'rich' ? ' fc-segment-active' : ''}`,
              'aria-pressed': state.prefs.mode === 'rich',
              onClick: () => store.setMode('rich'),
            }, t('settings.display.rich')),
            h('button', {
              type: 'button',
              className: `fc-segment${state.prefs.mode === 'plain' ? ' fc-segment-active' : ''}`,
              'aria-pressed': state.prefs.mode === 'plain',
              onClick: () => store.setMode('plain'),
            }, t('settings.display.plain')),
          ),
        ),
        h('section', { className: 'fc-section' },
          h('div', { className: 'fc-row' },
            h('div', { className: 'fc-row-body' },
              h('div', { className: 'fc-row-title' }, t('settings.notifications')),
              h('div', { className: 'fc-hint' }, t('settings.notifications.hint')),
            ),
            h('button', {
              type: 'button',
              role: 'switch',
              'aria-checked': state.prefs.notifications,
              'aria-label': t('settings.notifications'),
              className: `fc-switch${state.prefs.notifications ? ' fc-switch-on' : ''}`,
              onClick: () => { void toggleNotifications() },
            }, h('span', { className: 'fc-switch-thumb' })),
          ),
          notificationError
            ? h('p', { className: 'fc-error', role: 'alert' }, supported ? t('settings.notifications.denied') : t('settings.notifications.unsupported'))
            : null,
        ),
        h('section', { className: 'fc-section' },
          h('div', { className: 'fc-row' },
            h('div', { className: 'fc-row-body' },
              h('div', { className: 'fc-row-title' }, t('settings.update')),
              h('div', { className: 'fc-hint' }, updateVersions(t, state.update)),
            ),
            h('button', {
              type: 'button',
              className: 'fc-button',
              disabled: state.checkingUpdate || state.installingUpdate,
              onClick: () => {
                if (state.update?.available === true) void store.installUpdate()
                else void store.checkUpdate()
              },
            }, state.installingUpdate
              ? t('settings.update.installing')
              : state.checkingUpdate
                ? t('settings.update.checking')
                : state.update?.available === true
                  ? t('settings.update.install')
                  : t('settings.update.check')),
          ),
        ),
      )
    }

    /**
     * A visible fallback for a render failure in the tab body, so a crash is
     * never an empty pane and the message can be reported without DevTools.
     */
    class ChatBoundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { error: null }
      }

      static getDerivedStateFromError(error) {
        return { error }
      }

      componentDidCatch(error, info) {
        console.error('[fishpi-chat] chat panel crashed', error, info)
      }

      render() {
        if (this.state.error !== null) {
          const message = this.state.error instanceof Error ? this.state.error.message : String(this.state.error)
          const title = typeof this.props.t === 'function' ? this.props.t('error.crash') : 'FishPi chat error'
          return h('div', { className: 'fc-crash' }, h(Style), `${title}: ${message}`)
        }
        return this.props.children
      }
    }

    /** Slot entry for the chat body: boundary plus the real panel. */
    function ChatTabBody(props) {
      return h(ChatBoundary, { t: props.t }, h(ChatPanel, props))
    }

    /**
     * @param {Function} t - bound translate.
     * @param {string} type - red-packet type id.
     * @returns {string} the localized type label.
     */
    function redPacketTypeLabel(t, type) {
      const key = `redPacket.type.${type}`
      const label = t(key)
      return label === key ? t('redPacket.title') : label
    }

    /**
     * @param {unknown} value - millisecond timestamp or a preformatted legacy string.
     * @returns {string} display text.
     */
    function claimTime(value) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        try {
          return new Date(value).toLocaleString()
        } catch {
          return ''
        }
      }
      return typeof value === 'string' ? value : ''
    }

    /**
     * @param {object} detail - red-packet detail from the Host.
     * @returns {Array<{user: object, amount: number, time: unknown, gesture?: number, outcome?: string}>}
     */
    function redPacketClaims(detail) {
      if (Array.isArray(detail?.claims)) {
        return detail.claims.map(entry => ({
          user: entry?.user ?? {},
          amount: Number(entry?.amount) || 0,
          time: entry?.claimedAt,
          gesture: entry?.gesture,
          outcome: entry?.outcome,
        }))
      }
      if (Array.isArray(detail?.who)) {
        return detail.who.map(entry => ({
          user: { userName: entry?.userName ?? '', userAvatarURL: entry?.avatar ?? '' },
          amount: Number(entry?.userMoney) || 0,
          time: entry?.time,
        }))
      }
      return []
    }

    /** Public user profile, with medal icons only. */
    function UserInfoDialog({ t }) {
      const store = sharedStore
      const state = useStore()
      const name = state.userInfoName
      const profile = state.userInfo

      useEffect(() => {
        if (name === null) return undefined
        const onKey = event => {
          if (event.key === 'Escape') store.closeUserInfo()
        }
        document.addEventListener('keydown', onKey)
        return () => { document.removeEventListener('keydown', onKey) }
      }, [name, store])

      if (name === null) return null

      const error = state.userInfoError
      const medals = Array.isArray(state.userInfoMedals) ? state.userInfoMedals : []
      const identity = profile === null
        ? []
        : [
            profile.userNo === '' ? '' : t('user.number', { number: profile.userNo }),
            profile.userCity === '' ? '' : t('user.location', { city: profile.userCity }),
          ].filter(Boolean)
      const stats = profile === null
        ? []
        : [
            profile.userPoint === undefined ? '' : t('user.points', { points: profile.userPoint }),
            profile.onlineMinute === undefined ? '' : t('user.online', { minutes: profile.onlineMinute }),
          ].filter(Boolean)
      const memberUrl = profile === null
        ? ''
        : `${state.siteUrl.replace(/\/+$/u, '')}/member/${encodeURIComponent(profile.userName || name)}`

      return h('div', {
        className: 'fc-modal-mask',
        role: 'presentation',
        onClick: () => store.closeUserInfo(),
      },
        h('div', {
          className: 'fc-modal',
          role: 'dialog',
          'aria-modal': 'true',
          'aria-label': t('user.title'),
          onClick: event => event.stopPropagation(),
        },
          h('div', { className: 'fc-modal-head' },
            h('div', { className: 'fc-modal-title' }, t('user.title')),
            h('button', {
              type: 'button',
              className: 'fc-icon-button',
              'aria-label': t('user.close'),
              title: t('user.close'),
              onClick: () => store.closeUserInfo(),
            }, '×'),
          ),
          state.userInfoLoading && profile === null
            ? h('p', { className: 'fc-hint' }, t('loading'))
            : null,
          error === null
            ? null
            : h('div', { className: 'fc-banner', role: 'alert' },
                h('span', null, localizedError(error.code, error.message, t)),
                h('button', {
                  type: 'button',
                  className: 'fc-icon-button',
                  'aria-label': t('redPacket.retry'),
                  title: t('redPacket.retry'),
                  onClick: () => { void store.openUserInfo(name) },
                }, '⟳'),
              ),
          profile === null
            ? null
            : h('div', { className: 'fc-user-body' },
                h('div', { className: 'fc-user-head' },
                  h(Avatar, {
                    url: profile.userAvatarURL ?? '',
                    name: profile.userNickname || profile.userName || '',
                    size: 56,
                  }),
                  h('div', { className: 'fc-user-heading' },
                    h('div', { className: 'fc-user-name-line' },
                      h('div', { className: 'fc-user-name' }, displayUser(profile)),
                      h('a', {
                        className: 'fc-user-home-link',
                        href: memberUrl,
                        target: '_blank',
                        rel: 'noopener noreferrer',
                      }, t('user.home')),
                    ),
                    profile.userRole !== ''
                      ? h('div', { className: 'fc-user-role' }, profile.userRole)
                      : null,
                    identity.length > 0
                      ? h('div', { className: 'fc-user-meta' }, identity.join(' · '))
                      : null,
                    stats.length > 0
                      ? h('div', { className: 'fc-user-meta' }, stats.join(' · '))
                      : null,
                  ),
                ),
                profile.userIntro !== ''
                  ? h('div', { className: 'fc-user-intro' }, profile.userIntro)
                  : null,
                profile.userURL !== ''
                  ? h('div', { className: 'fc-user-links' },
                      h('a', {
                        className: 'fc-user-profile-link',
                        href: profile.userURL,
                        target: '_blank',
                        rel: 'noopener noreferrer',
                      }, t('user.profileLink')),
                    )
                  : null,
                medals.length > 0
                  ? h('div', { className: 'fc-user-medals-section' },
                      h('div', { className: 'fc-modal-section-title' }, t('user.medals')),
                      h('div', { className: 'fc-user-medals' },
                        medals.map(medal => h('div', { className: 'fc-medal-row', key: medal.id || medal.name || medal.url },
                          h('img', {
                            className: 'fc-medal-icon',
                            src: medal.url,
                            alt: medal.name,
                            title: [medal.name, medal.description].filter(Boolean).join(' · '),
                            loading: 'lazy',
                            referrerPolicy: 'no-referrer',
                            onError: event => { event.currentTarget.style.display = 'none' },
                          }),
                          h('div', { className: 'fc-medal-text' },
                            h('div', { className: 'fc-medal-name' }, medal.name),
                            medal.description !== ''
                              ? h('div', { className: 'fc-medal-meta' }, medal.description)
                              : null,
                          ),
                        )),
                      ),
                    )
                  : null,
              ),
        ),
      )
    }

    /** Red-packet detail and claim dialog. */
    function RedPacketDialog({ t }) {
      const store = sharedStore
      const state = useStore()
      const id = state.redPacketId
      const [riskAccepted, setRiskAccepted] = useState(false)
      const [gesture, setGesture] = useState(null)

      useEffect(() => {
        setRiskAccepted(false)
        const initial = sharedStore.getSnapshot().redPacketGesture
        setGesture(Number.isInteger(initial) ? initial : null)
      }, [id])

      useEffect(() => {
        if (id === null) return undefined
        const onKey = event => {
          if (event.key === 'Escape') store.closeRedPacket()
        }
        document.addEventListener('keydown', onKey)
        return () => { document.removeEventListener('keydown', onKey) }
      }, [id, store])

      if (id === null) return null

      const detail = state.redPacket
      const error = state.redPacketError
      const claim = state.redPacketClaim
      const myClaim = detail?.currentUserClaim ?? claim
      const type = typeof detail?.type === 'string' ? detail.type : ''
      const isRps = type === 'rockPaperScissors'
      const risky = type === 'heartbeat' || isRps
      const needsRiskCheck = type === 'heartbeat'
      const count = Number(detail?.count) || 0
      const got = Number(detail?.got) || 0
      const finished = detail !== null && count > 0 && got >= count
      const claims = detail === null ? [] : redPacketClaims(detail)
      const own = detail?.sender?.id !== undefined
        && String(detail.sender.id) === (state.user?.id ?? '')
      const canClaim = detail !== null
        && detail.legacy !== true
        && !finished
        && myClaim === null
        && !state.redPacketClaiming
        && !(own && type !== 'heartbeat')
        && (!needsRiskCheck || riskAccepted)
        && (!isRps || gesture !== null)

      const amountText = value => {
        const amount = Number(value) || 0
        return amount > 0 ? `+${amount}` : String(amount)
      }

      const submit = async () => {
        if (!canClaim) return
        await store.claimRedPacket({
          riskAccepted: isRps ? true : riskAccepted,
          gesture: isRps && gesture !== null ? gesture : undefined,
        })
      }

      const close = h('button', {
        type: 'button',
        className: 'fc-icon-button',
        'aria-label': t('redPacket.close'),
        title: t('redPacket.close'),
        onClick: () => store.closeRedPacket(),
      }, '×')

      const dialogTitle = detail === null ? t('redPacket.title') : redPacketTypeLabel(t, detail.type)
      const header = h('div', { className: 'fc-modal-head' },
        h('div', { className: 'fc-modal-title' }, dialogTitle),
        close,
      )

      const claimRows = claims.length === 0
        ? h('p', { className: 'fc-hint' }, t('redPacket.noClaims'))
        : h('div', { className: 'fc-claims' }, claims.map((entry, index) => {
            const name = displayUser(entry.user)
            const avatarName = entry.user?.userNickname || entry.user?.userName || ''
            return h('div', { className: 'fc-claim-row', key: `${index}-${name}` },
              entry.user?.userName
                ? h('button', {
                    type: 'button',
                    className: 'fc-avatar-button',
                    'aria-label': name,
                    onClick: () => { void sharedStore.openUserInfo(entry.user.userName) },
                  }, h(Avatar, { url: entry.user?.userAvatarURL ?? '', name: avatarName, size: 22 }))
                : h(Avatar, { url: entry.user?.userAvatarURL ?? '', name: avatarName, size: 22 }),
              entry.user?.userName
                ? h('button', {
                    type: 'button',
                    className: 'fc-claim-name fc-user-link',
                    onClick: () => { void sharedStore.openUserInfo(entry.user.userName) },
                  }, name)
                : h('span', { className: 'fc-claim-name' }, name),
              entry.outcome === undefined ? null : h('span', { className: 'fc-claim-outcome' }, t(`redPacket.outcome.${entry.outcome}`)),
              h('span', { className: `fc-claim-amount${entry.amount < 0 ? ' fc-claim-negative' : ''}` }, amountText(entry.amount)),
              h('span', { className: 'fc-claim-time' }, claimTime(entry.time)),
            )
          }))

      let footer = null
      if (detail !== null && detail.legacy === true) {
        footer = h('p', { className: 'fc-hint' }, t('redPacket.legacy'))
      } else if (myClaim !== null && myClaim !== undefined) {
        // The claims list already carries this account's amount; keep the
        // detail neutral instead of repeating a personal ledger line.
        footer = null
      } else if (finished) {
        footer = h('p', { className: 'fc-hint' }, t('redPacket.finished'))
      } else if (own && type !== 'heartbeat') {
        footer = h('p', { className: 'fc-hint' }, t('redPacket.own'))
      } else if (detail !== null) {
        footer = h('div', { className: 'fc-claim-actions' },
          risky
            ? h('p', { className: 'fc-modal-warning' }, isRps ? t('redPacket.riskRps') : t('redPacket.riskHeartbeat'))
            : null,
          needsRiskCheck
            ? h('label', { className: 'fc-check' },
                h('input', {
                  type: 'checkbox',
                  checked: riskAccepted,
                  onChange: event => setRiskAccepted(event.target.checked),
                }),
                h('span', null, t('redPacket.riskAccept')),
              )
            : null,
          isRps
            ? h('div', { className: 'fc-gestures', role: 'group', 'aria-label': t('redPacket.gesture') },
                [[0, 'redPacket.shortRock', 'redPacket.rock'], [1, 'redPacket.shortScissors', 'redPacket.scissors'], [2, 'redPacket.shortPaper', 'redPacket.paper']].map(([value, shortKey, fullKey]) =>
                  h('button', {
                    key: value,
                    type: 'button',
                    className: `fc-segment${gesture === value ? ' fc-segment-active' : ''}`,
                    'aria-pressed': gesture === value,
                    title: t(fullKey),
                    'aria-label': t(fullKey),
                    onClick: () => setGesture(value),
                  }, t(shortKey)),
                ),
              )
            : null,
          h('button', {
            type: 'button',
            className: 'fc-button fc-button-primary',
            disabled: !canClaim,
            onClick: () => { void submit() },
          }, state.redPacketClaiming ? t('redPacket.claiming') : t('redPacket.claim')),
        )
      }

      return h('div', {
        className: 'fc-modal-mask',
        role: 'presentation',
        onClick: () => store.closeRedPacket(),
      },
        h('div', {
          className: 'fc-modal',
          role: 'dialog',
          'aria-modal': 'true',
          'aria-label': dialogTitle,
          onClick: event => event.stopPropagation(),
        },
          header,
          state.redPacketLoading && detail === null
            ? h('p', { className: 'fc-hint' }, t('loading'))
            : null,
          error === null
            ? null
            : h('div', { className: 'fc-banner', role: 'alert' },
                h('span', null, localizedError(error.code, error.message, t)),
                h('button', {
                  type: 'button',
                  className: 'fc-icon-button',
                  'aria-label': t('redPacket.retry'),
                  title: t('redPacket.retry'),
                  onClick: () => { void store.openRedPacket(id) },
                }, '⟳'),
              ),
          detail === null
            ? null
            : h('div', { className: 'fc-modal-body' },
                h('div', { className: 'fc-card-meta' },
                  redPacketTypeLabel(t, type),
                  detail.sender !== null && detail.sender !== undefined
                    ? ' · '
                    : '',
                  detail.sender?.userName
                    ? h('button', {
                        type: 'button',
                        className: 'fc-user-link',
                        onClick: () => { void sharedStore.openUserInfo(detail.sender.userName) },
                      }, t('redPacket.from', { name: displayUser(detail.sender) }))
                    : detail.sender !== null && detail.sender !== undefined
                      ? t('redPacket.from', { name: displayUser(detail.sender) })
                      : null,
                ),
                typeof detail.message === 'string' && detail.message !== ''
                  ? h('div', { className: 'fc-modal-message' }, detail.message)
                  : null,
                h('div', { className: 'fc-redpacket-progress' },
                  h('span', { style: { width: count > 0 ? `${Math.min(100, got / count * 100)}%` : '0%' } }),
                ),
                h('div', { className: 'fc-card-meta' }, [
                  t('redPacket.progress', { got, count }),
                  detail.poolPoints === undefined ? '' : t('redPacket.pool', { points: detail.poolPoints }),
                ].filter(Boolean).join(' · ')),
                h('div', { className: 'fc-modal-section-title' }, t('redPacket.claims')),
                claimRows,
              ),
          footer,
        ),
      )
    }

    /**
     * @param {{useTabInfo: Function, t: Function}} props - the right-Sidebar tab body.
     */
    function ChatPanel({ useTabInfo, t }) {
      const store = sharedStore
      const state = useStore()
      const info = useTabInfo()
      const visible = info?.tab?.visible === true
      const mode = state.prefs.mode
      const [draft, setDraft] = useState('')
      const [atBottom, setAtBottom] = useState(true)
      const [mention, setMention] = useState({ open: false, items: [], index: 0, start: 0, end: 0, query: '' })
      const mentionTimerRef = useRef()
      const mentionSeqRef = useRef(0)
      const scrollRef = useRef(null)
      const textareaRef = useRef(null)
      const fileInputRef = useRef(null)
      const stickRef = useRef(true)
      const restoreRef = useRef(null)
      const recallTimerRef = useRef()
      const [recallingId, setRecallingId] = useState('')

      useEffect(() => {
        store.setChatVisible(visible)
        return () => { store.setChatVisible(false) }
      }, [visible])

      useEffect(() => () => { clearTimeout(recallTimerRef.current) }, [])

      useLayoutEffect(() => {
        const element = scrollRef.current
        if (element === null) return
        if (restoreRef.current !== null) {
          const { height, top } = restoreRef.current
          restoreRef.current = null
          element.scrollTop = top + (element.scrollHeight - height)
          return
        }
        if (stickRef.current) element.scrollTop = element.scrollHeight
      }, [state.messages])

      useEffect(() => {
        void store.loadMedalIcons(state.messages)
      }, [state.messages])

      useEffect(() => {
        const element = textareaRef.current
        if (element === null) return
        element.style.height = 'auto'
        element.style.height = `${element.scrollHeight}px`
      }, [draft])

      const onScroll = useCallback(() => {
        const element = scrollRef.current
        if (element === null) return
        const near = element.scrollHeight - element.scrollTop - element.clientHeight < 80
        stickRef.current = near
        setAtBottom(near)
      }, [])

      const loadOlder = async () => {
        const element = scrollRef.current
        if (element !== null) restoreRef.current = { height: element.scrollHeight, top: element.scrollTop }
        const added = await store.loadOlder()
        if (added === 0) restoreRef.current = null
      }

      const doSend = async () => {
        const content = draft.trim()
        if (content === '' || state.sending) return
        stickRef.current = true
        const result = await store.send(content)
        if (result.ok) setDraft(current => current === content ? '' : current)
      }

      const onKeyDown = event => {
        if (event.isComposing === true || event.nativeEvent?.isComposing === true) return
        if (mention.open) {
          if (event.key === 'Escape') {
            event.preventDefault()
            closeMention()
            return
          }
          if (mention.items.length > 0) {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              const direction = event.key === 'ArrowDown' ? 1 : -1
              setMention(current => ({
                ...current,
                index: (current.index + direction + current.items.length) % current.items.length,
              }))
              return
            }
            if (event.key === 'Enter' || event.key === 'Tab') {
              event.preventDefault()
              selectMention(mention.items[mention.index] ?? mention.items[0])
              return
            }
          }
        }
        if (event.key !== 'Enter' || event.shiftKey || event.isComposing === true || event.nativeEvent?.isComposing === true) return
        event.preventDefault()
        void doSend()
      }

      const appendFiles = async files => {
        const images = [...files].filter(file => file !== null
          && typeof file === 'object'
          && typeof file.type === 'string'
          && file.type.startsWith('image/'))
        if (images.length === 0 || state.uploadingImages) return
        const result = await store.uploadImages(images)
        if (!result.ok || !Array.isArray(result.files) || result.files.length === 0) return
        const markdown = result.files
          .map(file => `![image](${file.url})`)
          .join('\n')
        setDraft(current => {
          const existing = current.replace(/\s+$/u, '')
          return existing === '' ? markdown : `${existing}\n${markdown}`
        })
        requestAnimationFrame(() => textareaRef.current?.focus())
      }

      const onPaste = event => {
        const files = [...(event.clipboardData?.files ?? [])]
          .filter(file => file.type.startsWith('image/'))
        if (files.length === 0) {
          for (const item of event.clipboardData?.items ?? []) {
            if (item.kind !== 'file' || !item.type.startsWith('image/')) continue
            const file = item.getAsFile()
            if (file !== null) files.push(file)
          }
        }
        if (files.length === 0) return
        event.preventDefault()
        void appendFiles(files)
      }

      const closeMention = () => {
        clearTimeout(mentionTimerRef.current)
        setMention(current => current.open || current.items.length > 0
          ? { open: false, items: [], index: 0, start: 0, end: 0, query: '' }
          : current)
      }

      const updateMention = (value, cursor) => {
        const before = value.slice(0, cursor)
        const match = /(^|[^\w-])@([A-Za-z0-9_-]{0,64})$/u.exec(before)
        if (match === null) {
          closeMention()
          return
        }
        const query = match[2]
        const start = cursor - query.length - 1
        if (query === '') {
          clearTimeout(mentionTimerRef.current)
          mentionSeqRef.current += 1
          setMention({
            open: true,
            items: state.onlineUsers.slice(0, 8),
            index: 0,
            start,
            end: cursor,
            query,
          })
          return
        }
        const lowered = query.toLowerCase()
        const localMatches = state.onlineUsers.filter(user => (
          typeof user.userName === 'string' && user.userName.toLowerCase().includes(lowered)
        ) || (
          typeof user.userNickname === 'string' && user.userNickname.toLowerCase().includes(lowered)
        )).slice(0, 8)
        setMention(current => ({
          open: true,
          items: current.query === query ? current.items : localMatches,
          index: 0,
          start,
          end: cursor,
          query,
        }))
        clearTimeout(mentionTimerRef.current)
        const seq = ++mentionSeqRef.current
        mentionTimerRef.current = setTimeout(async () => {
          const items = await store.suggestUsers(query)
          if (seq !== mentionSeqRef.current) return
          const seen = new Set()
          const merged = [...localMatches, ...items].filter(user => {
            const key = `${user.id ?? ''}:${(user.userName ?? '').toLowerCase()}`
            if (seen.has(key)) return false
            seen.add(key)
            return true
          }).slice(0, 8)
          setMention(current => current.open && current.query === query
            ? { ...current, items: merged, index: 0 }
            : current)
        }, 180)
      }

      const selectMention = user => {
        const userName = typeof user?.userName === 'string' ? user.userName : ''
        if (userName === '') {
          closeMention()
          return
        }
        const inserted = `@${userName} `
        const next = draft.slice(0, mention.start) + inserted + draft.slice(mention.end)
        setDraft(next)
        closeMention()
        requestAnimationFrame(() => {
          const element = textareaRef.current
          if (element === null) return
          element.focus()
          const position = mention.start + inserted.length
          element.setSelectionRange(position, position)
        })
      }

      const insertDraft = text => {
        const element = textareaRef.current
        const start = element?.selectionStart ?? draft.length
        const end = element?.selectionEnd ?? draft.length
        const next = draft.slice(0, start) + text + draft.slice(end)
        setDraft(next)
        requestAnimationFrame(() => {
          const target = textareaRef.current
          if (target === null) return
          target.focus()
          const position = start + text.length
          target.setSelectionRange(position, position)
          updateMention(next, position)
        })
      }

      /** @param {object} message - one normalized message. @returns {string} source text for a quote. */
      const quoteSource = message => {
        let source = ''
        if (message.type === 'text') {
          source = typeof message.content === 'string' ? message.content : ''
          if (source.trim() === '' && typeof message.contentHtml === 'string') source = plainFromHtml(message.contentHtml)
        }
        if (source.trim() === '') source = messageSummary(message, t)
        source = source.replace(/\r\n/gu, '\n').trimEnd()
        return source.length > 1000 ? `${source.slice(0, 1000)}…` : source
      }

      /** @param {object} message - one normalized message. */
      const quoteMessage = message => {
        const source = quoteSource(message)
        if (source === '') return
        const author = message.author?.userName ?? ''
        const site = state.siteUrl.replace(/\/+$/u, '')
        const link = `${site}/cr#chatroom${message.id}`
        const attribution = author !== ''
          ? `##### 引用 @${author} [↩](${link} "跳转至原消息")`
          : `##### 引用 [↩](${link} "跳转至原消息")`
        const quoted = source.split('\n').map(line => `> ${line}`).join('\n')
        const base = draft.trim() === '' ? '' : `${draft.replace(/\s+$/u, '')}\n\n`
        setDraft(`${base}${attribution}  \n${quoted}\n`)
        closeMention()
        requestAnimationFrame(() => {
          const element = textareaRef.current
          if (element === null) return
          element.focus()
          const position = element.value.length
          element.setSelectionRange(position, position)
        })
      }

      /** @param {object} message - one normalized message. */
      const mentionAuthor = message => {
        const userName = message.author?.userName ?? ''
        if (userName !== '') insertDraft(`@${userName} `)
      }

      /** @param {object} message - one normalized text message. */
      const repeatMessage = message => {
        if (state.sending) return
        const content = typeof message.content === 'string' ? message.content : ''
        if (message.type !== 'text' || content.trim() === '') return
        void store.send(content)
      }

      /** @param {object} message - one normalized message. */
      const requestRecall = message => {
        if (state.recalling) return
        if (recallingId !== message.id) {
          clearTimeout(recallTimerRef.current)
          setRecallingId(message.id)
          recallTimerRef.current = window.setTimeout(() => setRecallingId(''), 4000)
          return
        }
        clearTimeout(recallTimerRef.current)
        recallTimerRef.current = undefined
        setRecallingId('')
        void store.recall(message.id)
      }

      /** @param {object} message - one normalized message. @returns {object|null} its hover actions. */
      const messageActions = message => {
        if (message.type === 'system') return null
        const author = message.author ?? {}
        const own = author.id !== undefined && author.id !== '' && author.id === state.user?.id
        const canQuote = quoteSource(message) !== ''
        const canModerate = state.user?.capabilities?.chatRevokeOthers === true
        const canRecall = state.hostVersion !== ''
          && (own || canModerate)
          && message.type !== 'redPacket'
          && /^\d+$/u.test(message.id)
        const canMention = typeof author.userName === 'string' && author.userName !== '' && !own
        const canRepeat = message.type === 'text' && typeof message.content === 'string' && message.content.trim() !== ''
        if (!canQuote && !canRecall && !canMention && !canRepeat) return null
        const pending = recallingId === message.id
        return h('div', { className: 'fc-msg-actions', role: 'toolbar', 'aria-label': t('message.actions') },
          canQuote
            ? h('button', {
                type: 'button',
                className: 'fc-msg-action',
                title: t('message.quote'),
                'aria-label': t('message.quote'),
                onClick: () => quoteMessage(message),
              }, t('message.quoteShort'))
            : null,
          canRecall
            ? h('button', {
                type: 'button',
                className: `fc-msg-action fc-msg-action-danger${pending ? ' fc-msg-action-pending' : ''}`,
                disabled: state.recalling,
                title: pending
                  ? t('message.recallConfirm')
                  : (own ? t('message.recall') : t('message.recallModerate')),
                'aria-label': pending
                  ? t('message.recallConfirm')
                  : (own ? t('message.recall') : t('message.recallModerate')),
                onClick: () => requestRecall(message),
              }, pending ? t('message.recallConfirmShort') : t('message.recallShort'))
            : null,
          canMention
            ? h('button', {
                type: 'button',
                className: 'fc-msg-action',
                title: t('message.mention'),
                'aria-label': t('message.mention'),
                onClick: () => mentionAuthor(message),
              }, t('message.mentionShort'))
            : null,
          canRepeat
            ? h('button', {
                type: 'button',
                className: 'fc-msg-action',
                title: t('message.repeat'),
                'aria-label': t('message.repeat'),
                onClick: () => repeatMessage(message),
              }, t('message.repeatShort'))
            : null,
        )
      }

      const retry = async () => {
        store.clearError()
        await store.syncAll()
      }

      const header = h('div', { className: 'fc-header' },
        h('div', { className: 'fc-header-main' },
          h('span', { className: 'fc-title' }, t('tabTitle')),
          h(StatusDot, { state: state.connection, t }),
          state.connection === 'connected'
            ? null
            : h('span', { className: 'fc-status-text' }, state.connection === 'connecting' ? t('status.connecting') : t('status.disconnected')),
          state.loggedIn && state.user?.userName
            ? h('button', {
                type: 'button',
                className: 'fc-meta fc-user-link',
                onClick: () => { void store.openUserInfo(state.user.userName) },
              }, displayUser(state.user))
            : state.loggedIn
              ? h('span', { className: 'fc-meta' }, displayUser(state.user))
              : null,
        ),
        h('div', { className: 'fc-header-actions' },
          h('span', { className: 'fc-meta' }, t('online', { count: state.online })),
          state.loggedIn
            ? h('button', {
                type: 'button',
                className: 'fc-icon-button',
                title: t('refresh'),
                'aria-label': t('refresh'),
                onClick: () => { void retry() },
              }, h('span', { 'aria-hidden': 'true' }, '⟳'))
            : null,
        ),
        state.topic !== ''
          ? h('div', { className: 'fc-topic', title: state.topic }, `${t('topic')}: ${state.topic}`)
          : null,
      )

      const errorBanner = state.error === null
        ? null
        : h('div', { className: 'fc-banner', role: 'alert' },
            h('span', null, localizedError(state.error.code, state.error.message, t)),
            h('button', {
              type: 'button',
              className: 'fc-icon-button',
              'aria-label': t('error.dismiss'),
              title: t('error.dismiss'),
              onClick: () => store.clearError(),
            }, '×'),
          )

      const hostBanner = state.ready && state.hostVersion === ''
        ? h('div', { className: 'fc-banner', role: 'alert' }, h('span', null, t('host.restart')))
        : null

      if (!state.loaded) {
        return h('div', { className: 'fc-root' },
          h(Style), header, h('div', { className: 'fc-empty' }, t('loading')),
          h(RedPacketDialog, { t }), h(UserInfoDialog, { t }))
      }

      if (!state.loggedIn) {
        return h('div', { className: 'fc-root' },
          h(Style),
          header,
          errorBanner,
          hostBanner,
          h('div', { className: 'fc-login-wrap' },
            h('div', { className: 'fc-login-title' }, t('login.title')),
            h(LoginForm, { t, compact: true }),
          ),
          h(RedPacketDialog, { t }),
          h(UserInfoDialog, { t }),
        )
      }

      // Fold a run of identical text messages into a stack of whole message
      // cards: each card keeps its own avatar/name header and body, and every
      // later card overlaps the previous one. The stack lives only in this
      // render; nothing is persisted or sent.
      const runs = []
      let last = null
      for (const message of state.messages) {
        const repeat = message.type === 'text'
          && typeof message.content === 'string'
          && message.content.trim() !== ''
          && last !== null
          && last.type === 'text'
          && typeof last.content === 'string'
          && last.content === message.content
          && dayKey(last.createdAt) === dayKey(message.createdAt)
        if (repeat && runs.length > 0) runs[runs.length - 1].push(message)
        else runs.push([message])
        last = message
      }
      const display = runs.map(run => ({
        message: run[0],
        stack: { count: run.length, messages: run },
      }))

      let previous = null
      const rows = []
      for (const entry of display) {
        const message = entry.message
        const authorId = message.author?.id ?? ''
        const authorName = message.author?.userName ?? ''
        const dateChanged = previous === null || dayKey(message.createdAt) !== dayKey(previous.message.createdAt)
        if (dateChanged) rows.push(h('div', { className: 'fc-day', key: `day-${message.id}` }, dayLabel(message.createdAt, t)))
        const stacked = entry.stack.messages.length > 1
        const front = entry.stack.messages[entry.stack.messages.length - 1] ?? message
        const grouped = !stacked
          && !dateChanged
          && previous !== null
          && previous.stack.count === 1
          && message.type === 'text'
          && previous.message.type === 'text'
          && authorId !== ''
          && authorId === (previous.message.author?.id ?? '')
          && message.createdAt - previous.message.createdAt < 5 * 60 * 1000
        if (stacked) {
          rows.push(h(MessageStack, {
            key: message.id,
            messages: entry.stack.messages,
            mode,
            t,
            siteUrl: state.siteUrl,
            medalIcons: state.medalIcons,
            actions: messageActions(front),
          }))
        } else {
          rows.push(h(MessageRow, {
            key: message.id,
            message,
            own: authorId !== '' && authorId === state.user?.id,
            grouped,
            mode,
            t,
            siteUrl: state.siteUrl,
            medalIcons: authorName !== '' ? state.medalIcons[authorName] ?? [] : [],
            actions: messageActions(message),
          }))
        }
        previous = entry
      }

      const body = state.loadingMessages && state.messages.length === 0
        ? h('div', { className: 'fc-empty' }, t('loading'))
        : state.messages.length === 0
          ? h('div', { className: 'fc-empty' }, t('empty'))
          : h('div', { className: 'fc-list', ref: scrollRef, onScroll, role: 'log', 'aria-label': t('messages') },
              state.hasMore
                ? h('button', {
                    type: 'button',
                    className: 'fc-load-older',
                    disabled: state.loadingOlder,
                    onClick: () => { void loadOlder() },
                  }, state.loadingOlder ? t('loading') : t('loadOlder'))
                : null,
              rows,
            )

      return h('div', { className: 'fc-root' },
        h(Style),
        header,
        errorBanner,
        hostBanner,
        body,
        state.messages.length > 0 && !atBottom
          ? h('button', {
              type: 'button',
              className: 'fc-jump',
              'aria-label': t('jump'),
              title: t('jump'),
              onClick: () => {
                stickRef.current = true
                setAtBottom(true)
                const element = scrollRef.current
                if (element !== null) element.scrollTop = element.scrollHeight
              },
            }, '↓')
          : null,
        h('div', { className: 'fc-composer' },
          mention.open
            ? h('div', {
                className: 'fc-mention-popover',
                id: 'fc-mention-list',
                role: 'listbox',
                'aria-label': t('mention.title'),
              },
                mention.items.length === 0
                  ? h('div', { className: 'fc-mention-empty' }, mention.query === '' ? t('mention.hint') : t('mention.empty'))
                  : mention.items.map((user, index) => h('button', {
                      key: `${user.id || user.userName || index}-${index}`,
                      type: 'button',
                      role: 'option',
                      tabIndex: -1,
                      'aria-selected': index === mention.index,
                      className: 'fc-mention-option',
                      onMouseDown: event => event.preventDefault(),
                      onClick: () => selectMention(user),
                    },
                      h(Avatar, {
                        url: user.userAvatarURL ?? '',
                        name: user.userNickname || user.userName || '',
                        size: 22,
                      }),
                      h('span', { className: 'fc-mention-name' }, displayUser(user)),
                    )),
              )
            : null,
          h('div', { className: 'fc-composer-row' },
            h('button', {
              type: 'button',
              className: 'fc-plus',
              title: t('composer.addImage'),
              'aria-label': t('composer.addImage'),
              disabled: state.uploadingImages,
              onClick: () => fileInputRef.current?.click(),
            }, '+'),
            h('textarea', {
              ref: textareaRef,
              className: 'fc-textarea',
              rows: 1,
              value: draft,
              'aria-label': t('composer.label'),
              'aria-autocomplete': 'list',
              'aria-expanded': mention.open,
              'aria-controls': mention.open ? 'fc-mention-list' : undefined,
              placeholder: t('composer.placeholder'),
              onChange: event => {
                const value = event.target.value
                setDraft(value)
                updateMention(value, event.target.selectionStart ?? value.length)
              },
              onKeyDown,
              onPaste,
              onBlur: () => { window.setTimeout(() => closeMention(), 120) },
              maxLength: 4096,
            }),
            h('button', {
              type: 'button',
              className: 'fc-button fc-button-primary fc-send',
              disabled: draft.trim() === '' || state.sending || state.uploadingImages,
              onClick: () => { void doSend() },
            }, state.sending ? t('composer.sending') : t('composer.send')),
          ),
          h('input', {
            ref: fileInputRef,
            type: 'file',
            accept: 'image/*',
            multiple: true,
            style: { display: 'none' },
            onChange: event => {
              const files = [...(event.target.files ?? [])]
              event.target.value = ''
              if (files.length > 0) void appendFiles(files)
            },
          }),
          h('div', { className: 'fc-composer-foot' },
            h('span', { className: `fc-count${draft.length > 3800 ? ' fc-count-warn' : ''}` },
              state.uploadingImages
                ? t('composer.uploading')
                : draft.length > 0 ? `${draft.length}/4096` : ''),
          ),
        ),
        h(RedPacketDialog, { t }),
        h(UserInfoDialog, { t }),
      )
    }

    /** Live tab chip: unread count beside the title. */
    function ChatTabTitle({ t }) {
      const state = useStore()
      return h('span', null, state.unread > 0 ? `${t('tabTitle')} · ${state.unread}` : t('tabTitle'))
    }

    /** Session-header chat button with an unread dot. */
    function HeaderButton({ t }) {
      const state = useStore()
      const unread = state.unread
      return h('button', {
        type: 'button',
        className: 'fc-header-entry',
        title: unread > 0 ? `${t('open')} (${unread})` : t('open'),
        'aria-label': unread > 0 ? `${t('open')} (${unread})` : t('open'),
        onClick: () => openChat(),
      },
        h(IconFish, { size: 17 }),
        unread > 0 ? h('span', { className: 'fc-badge', 'aria-hidden': 'true' }) : null,
      )
    }

    /** @type {ReturnType<createStore>|undefined} */
    let sharedStore
    /** @type {object|undefined} */
    let sharedContext

    /**
     * @param {object} styleProps - unused; keeps the component signature stable.
     * @returns {object} a `<style>` element scoped to `fc-` classes.
     */
    function Style() {
      return h('style', null, `
        .fc-root {
          display: flex;
          flex: 1 1 auto;
          flex-direction: column;
          width: 100%;
          height: 100%;
          min-width: 0;
          min-height: 0;
          position: relative;
          color: var(--dsw-alias-label-primary);
          font-size: var(--dsh-content-font-size, 14px);
        }
        .fc-crash {
          padding: 20px;
          color: var(--dsw-alias-state-error-primary);
          font-size: 13px;
          line-height: 20px;
          overflow-wrap: anywhere;
          white-space: pre-wrap;
        }
        .fc-header {
          flex: none;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 4px 8px;
          padding: 8px 12px;
          border-bottom: 1px solid var(--dsw-alias-border-l2);
        }
        .fc-header-main { display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1; }
        .fc-header-actions { display: flex; align-items: center; gap: 8px; margin-left: auto; }
        .fc-topic { flex-basis: 100%; }
        .fc-title { font-size: 13px; font-weight: 500; }
        .fc-meta { color: var(--dsw-alias-label-tertiary); font-size: 12px; white-space: nowrap; }
        .fc-topic {
          overflow: hidden;
          color: var(--dsw-alias-label-secondary);
          font-size: 12px;
          line-height: 17px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .fc-status { width: 7px; height: 7px; border-radius: 50%; flex: none; background: var(--dsw-alias-label-tertiary); }
        .fc-status-text { color: var(--dsw-alias-label-tertiary); font-size: 11px; white-space: nowrap; }
        .fc-status-connected { background: var(--dsw-alias-state-success-primary); }
        .fc-status-connecting { background: var(--dsw-alias-state-warn-primary); }
        .fc-status-disconnected { background: var(--dsw-alias-state-error-primary); }
        .fc-icon-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          padding: 0;
          border: 0;
          border-radius: 6px;
          background: transparent;
          color: var(--dsw-alias-label-tertiary);
          font: inherit;
          font-size: 15px;
          cursor: pointer;
        }
        .fc-icon-button:hover { color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-interactive-bg-hover); }
        .fc-banner {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 6px 12px 0;
          padding: 6px 10px;
          border: 1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary) 35%, transparent);
          border-radius: var(--dsw-radius-md);
          background: var(--dsw-alias-bg-layer-2);
          background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 12%, var(--dsw-alias-bg-layer-2));
          color: var(--dsw-alias-state-error-primary);
          font-size: 12px;
          line-height: 17px;
        }
        .fc-banner > span { flex: 1; min-width: 0; }
        .fc-list {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 8px 12px 12px;
          overscroll-behavior: contain;
        }
        .fc-day { margin: 10px 0 6px; color: var(--dsw-alias-label-tertiary); font-size: 11px; text-align: center; }
        .fc-msg-line { position: relative; margin-top: 10px; }
        .fc-msg-line.fc-grouped { margin-top: 3px; }
        .fc-msg { display: flex; gap: 8px; }
        .fc-msg-actions {
          flex: none;
          display: flex;
          gap: 2px;
          align-self: flex-start;
          padding: 2px;
          border: 1px solid var(--dsw-alias-border-l2);
          border-radius: var(--dsw-radius-md);
          background: var(--dsw-alias-bg-layer-2);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          opacity: 0;
          pointer-events: none;
          transition: opacity 120ms ease;
        }
        .fc-msg-body:hover .fc-msg-actions,
        .fc-msg-body:focus-within .fc-msg-actions {
          opacity: 1;
          pointer-events: auto;
        }
        .fc-msg-action {
          width: auto;
          min-width: 20px;
          height: 20px;
          padding: 0 3px;
          border: 0;
          border-radius: 4px;
          background: transparent;
          color: var(--dsw-alias-label-tertiary);
          font: inherit;
          font-size: 11px;
          line-height: 20px;
          text-align: center;
          cursor: pointer;
        }
        .fc-msg-action:hover:not(:disabled) {
          background: var(--dsw-alias-interactive-bg-hover);
          color: var(--dsw-alias-label-primary);
        }
        .fc-msg-action:focus-visible { outline: 2px solid var(--dsw-focus-ring-color); outline-offset: 1px; }
        .fc-msg-action:disabled { opacity: 0.45; cursor: default; }
        .fc-msg-action-danger { color: var(--dsw-alias-state-error-primary); }
        .fc-msg-action-pending {
          background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 18%, transparent);
          color: var(--dsw-alias-state-error-primary);
        }
        .fc-msg-content-row {
          position: relative;
          display: inline-flex;
          align-items: flex-start;
          gap: 4px;
          max-width: 100%;
          vertical-align: top;
        }
        .fc-msg-content-row .fc-msg-content { flex: 1 1 auto; }
        .fc-msg-stack-row { margin-top: 10px; }
        .fc-msg-stack {
          position: relative;
          display: inline-block;
          max-width: 100%;
          vertical-align: top;
        }
        .fc-stack-card {
          position: absolute;
          left: 0;
          right: 0;
          box-sizing: border-box;
          padding: 4px 8px;
          border: 1px solid var(--dsw-alias-border-l2);
          border-radius: var(--dsw-radius-md);
          background: var(--dsw-alias-bg-layer-2);
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
          overflow: hidden;
        }
        .fc-stack-card-front { position: relative; }
        .fc-stack-card .fc-msg-line { margin-top: 0; }
        .fc-stack-card .fc-msg-body { padding-top: 5px; }
        .fc-stack-card-front:hover .fc-msg-actions,
        .fc-stack-card-front:focus-within .fc-msg-actions {
          opacity: 1;
          pointer-events: auto;
        }
        .fc-msg.fc-own { flex-direction: row-reverse; }
        .fc-msg.fc-own .fc-msg-body { display: flex; flex-direction: column; align-items: flex-end; }
        .fc-msg.fc-own .fc-msg-head { flex-direction: row-reverse; }
        .fc-msg.fc-own .fc-msg-content { max-width: 100%; text-align: left; }
        .fc-msg.fc-own .fc-msg-name { color: var(--dsw-alias-brand-text); }
        .fc-msg.fc-own .fc-msg-content-row { flex-direction: row-reverse; }
        .fc-avatar { flex: none; border-radius: 50%; object-fit: cover; background: var(--dsw-alias-bg-layer-2); }
        .fc-avatar-button {
          display: inline-flex;
          flex: none;
          padding: 0;
          border: 0;
          border-radius: 50%;
          background: none;
          cursor: pointer;
        }
        .fc-avatar-button:hover { opacity: 0.85; }
        .fc-avatar-button:focus-visible { outline: 2px solid var(--dsw-focus-ring-color); outline-offset: 1px; }
        .fc-avatar-spacer { flex: none; width: 28px; }
        .fc-avatar-fallback {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--dsw-alias-label-secondary);
          font-weight: 500;
        }
        .fc-msg-body { position: relative; min-width: 0; flex: 0 1 auto; max-width: 100%; }
        .fc-msg-head { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
        .fc-msg-name { overflow: hidden; font-size: 12px; font-weight: 500; color: var(--dsw-alias-label-secondary); text-overflow: ellipsis; white-space: nowrap; }
        .fc-user-link {
          padding: 0;
          border: 0;
          background: none;
          color: inherit;
          font: inherit;
          text-align: inherit;
          cursor: pointer;
        }
        .fc-user-link:hover { text-decoration: underline; color: var(--dsw-alias-link); }
        .fc-msg-time { flex: none; color: var(--dsw-alias-label-tertiary); font-size: 11px; }
        .fc-msg-medals { display: inline-flex; flex: none; align-items: center; gap: 2px; }
        .fc-msg-medal { width: 14px; height: 14px; border-radius: 3px; object-fit: cover; background: var(--dsw-alias-bg-layer-2); }
        .fc-msg-content { margin-top: 3px; min-width: 0; overflow-wrap: anywhere; line-height: 1.55; }
        .fc-html > :first-child, .fc-plain > :first-child { margin-top: 0; }
        .fc-html > :last-child, .fc-plain > :last-child { margin-bottom: 0; }
        .fc-html p, .fc-plain p { margin: 0 0 6px; }
        .fc-html a, .fc-plain a { color: var(--dsw-alias-link); text-decoration: none; }
        .fc-html a:hover, .fc-plain a:hover { text-decoration: underline; }
        .fc-html img { display: block; max-width: 100%; max-height: 320px; margin: 6px 0; border-radius: var(--dsw-radius-md); }
        .fc-html pre, .fc-plain pre {
          overflow-x: auto;
          margin: 6px 0;
          padding: 8px 10px;
          border-radius: var(--dsw-radius-md);
          background: var(--dsw-alias-markdown-code-block);
          font-family: var(--ds-font-family-code, ui-monospace, monospace);
          font-size: 12px;
        }
        .fc-html code, .fc-plain code {
          padding: 1px 4px;
          border-radius: 4px;
          background: var(--dsw-alias-markdown-inline-code);
          font-family: var(--ds-font-family-code, ui-monospace, monospace);
          font-size: 0.92em;
        }
        .fc-html blockquote, .fc-plain blockquote {
          margin: 6px 0;
          padding-left: 10px;
          border-left: 3px solid var(--dsw-alias-border-l2);
          color: var(--dsw-alias-label-secondary);
        }
        .fc-html ul, .fc-html ol, .fc-plain ul, .fc-plain ol { margin: 4px 0; padding-left: 22px; }
        .fc-html table { display: block; max-width: 100%; overflow-x: auto; border-collapse: collapse; }
        .fc-html th, .fc-html td { padding: 3px 6px; border: 1px solid var(--dsw-alias-border-l2); }
        .fc-plain { white-space: pre-wrap; }
        .fc-system { margin: 12px 0 4px; color: var(--dsw-alias-label-tertiary); font-size: 11px; text-align: center; }
        .fc-card {
          display: flex;
          flex-direction: column;
          gap: 3px;
          margin-top: 4px;
          padding: 8px 10px;
          border: 1px solid var(--dsw-alias-border-l2);
          border-radius: var(--dsw-radius-md);
          background: var(--dsw-alias-card-fill);
        }
        .fc-card-redpacket { border-color: var(--dsw-alias-state-warn-primary); }
        .fc-card-button {
          width: fit-content;
          max-width: 100%;
          box-sizing: border-box;
          appearance: none;
          font: inherit;
          color: inherit;
          text-align: left;
          cursor: pointer;
        }
        .fc-card-button:hover { background: var(--dsw-alias-card-fill-hover); }
        .fc-card-blocked { cursor: default; }
        .fc-card-controls { display: flex; flex-direction: column; gap: 6px; margin-top: 2px; }
        .fc-card-check {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--dsw-alias-label-secondary);
          font-size: 11px;
          line-height: 16px;
          cursor: pointer;
        }
        .fc-card-check input { margin: 0; accent-color: var(--dsw-alias-state-business-primary); }
        .fc-card-state { color: var(--dsw-alias-label-tertiary); font-size: 11px; }
        .fc-gesture-row { display: flex; gap: 6px; margin-top: 4px; }
        .fc-gesture-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          padding: 0;
          border: 1px solid var(--dsw-alias-border-l2);
          border-radius: var(--dsw-radius-sm);
          background: var(--dsw-alias-bg-layer-1);
          color: var(--dsw-alias-label-secondary);
          cursor: pointer;
        }
        .fc-gesture-button:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
        .fc-gesture-button:focus-visible { outline: 2px solid var(--dsw-focus-ring-color); outline-offset: 1px; }
        .fc-gesture-button:disabled { opacity: 0.4; cursor: default; }
        .fc-card-title { font-size: 12px; font-weight: 500; color: var(--dsw-alias-label-secondary); }
        .fc-card-body { font-size: 13px; }
        .fc-card-meta { color: var(--dsw-alias-label-tertiary); font-size: 11px; }
        .fc-modal-mask {
          position: absolute;
          inset: 0;
          z-index: 30;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 12px;
          box-sizing: border-box;
          background: var(--dsw-alias-bg-mask-1);
          backdrop-filter: var(--dsw-mask-blur);
        }
        .fc-modal {
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: 100%;
          max-width: 400px;
          max-height: 100%;
          overflow: auto;
          padding: 14px;
          box-sizing: border-box;
          border-radius: var(--dsw-radius-lg);
          background: var(--dsw-alias-bg-layer-2);
          box-shadow: var(--dsw-elevation-prominent);
          color: var(--dsw-alias-label-primary);
        }
        .fc-modal-head { display: flex; align-items: center; gap: 8px; }
        .fc-modal-title { flex: 1; min-width: 0; font-size: 14px; font-weight: 500; }
        .fc-modal-body { display: flex; flex-direction: column; gap: 6px; }
        .fc-modal-message { font-size: 13px; line-height: 19px; overflow-wrap: anywhere; }
        .fc-modal-section-title { margin-top: 4px; color: var(--dsw-alias-label-secondary); font-size: 12px; }
        .fc-modal-warning {
          margin: 0;
          padding: 8px 10px;
          border-radius: var(--dsw-radius-md);
          background: var(--dsw-alias-state-warn-tertiary);
          color: var(--dsw-alias-state-warn-label);
          font-size: 12px;
          line-height: 18px;
        }
        .fc-redpacket-progress { height: 4px; overflow: hidden; border-radius: 999px; background: var(--dsw-alias-bg-layer-3); }
        .fc-redpacket-progress > span { display: block; height: 100%; background: var(--dsw-alias-state-warn-primary); }
        .fc-claims { display: flex; flex-direction: column; gap: 6px; max-height: 220px; overflow-y: auto; padding-right: 2px; }
        .fc-claim-row { display: flex; align-items: center; gap: 6px; min-width: 0; font-size: 12px; }
        .fc-claim-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .fc-claim-outcome { color: var(--dsw-alias-label-secondary); font-size: 11px; }
        .fc-claim-amount { color: var(--dsw-alias-state-success-primary); font-variant-numeric: tabular-nums; }
        .fc-claim-negative { color: var(--dsw-alias-state-error-primary); }
        .fc-claim-time { color: var(--dsw-alias-label-tertiary); font-size: 10px; white-space: nowrap; }
        .fc-claim-actions { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
        .fc-user-body { display: flex; flex-direction: column; gap: 10px; }
        .fc-user-head { display: flex; align-items: center; gap: 12px; min-width: 0; }
        .fc-user-heading { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .fc-user-name-line { display: flex; align-items: center; gap: 8px; min-width: 0; }
        .fc-user-name { overflow: hidden; font-size: 14px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
        .fc-user-home-link {
          flex: none;
          padding: 1px 8px;
          border: 1px solid var(--dsw-alias-border-l2);
          border-radius: 999px;
          color: var(--dsw-alias-link);
          font-size: 11px;
          line-height: 16px;
          text-decoration: none;
        }
        .fc-user-home-link:hover { background: var(--dsw-alias-interactive-bg-hover); }
        .fc-user-role { color: var(--dsw-alias-label-secondary); font-size: 12px; }
        .fc-user-meta { color: var(--dsw-alias-label-tertiary); font-size: 11px; }
        .fc-user-intro { color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 19px; overflow-wrap: anywhere; white-space: pre-wrap; }
        .fc-user-links { display: flex; flex-wrap: wrap; gap: 12px; }
        .fc-user-profile-link { color: var(--dsw-alias-link); font-size: 12px; text-decoration: none; }
        .fc-user-profile-link:hover { text-decoration: underline; }
        .fc-user-medals-section { display: flex; flex-direction: column; gap: 6px; }
        .fc-user-medals { display: flex; flex-direction: column; gap: 8px; }
        .fc-medal-row { display: flex; align-items: flex-start; gap: 8px; min-width: 0; }
        .fc-medal-icon { flex: none; width: 22px; height: 22px; border-radius: 4px; object-fit: cover; background: var(--dsw-alias-bg-layer-2); }
        .fc-medal-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
        .fc-medal-name { font-size: 12px; font-weight: 500; }
        .fc-medal-meta { color: var(--dsw-alias-label-tertiary); font-size: 11px; line-height: 16px; overflow-wrap: anywhere; }
        .fc-gestures { display: flex; gap: 2px; }
        .fc-unavailable { color: var(--dsw-alias-label-tertiary); font-style: italic; }
        .fc-empty { flex: 1; display: flex; align-items: center; justify-content: center; padding: 24px; color: var(--dsw-alias-label-tertiary); font-size: 12px; text-align: center; }
        .fc-load-older {
          display: block;
          width: 100%;
          margin: 4px 0 2px;
          padding: 4px;
          border: 0;
          border-radius: var(--dsw-radius-sm);
          background: transparent;
          color: var(--dsw-alias-label-tertiary);
          font: inherit;
          font-size: 11px;
          cursor: pointer;
        }
        .fc-load-older:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-secondary); }
        .fc-jump {
          position: absolute;
          right: 16px;
          bottom: 108px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border: 1px solid var(--dsw-alias-border-l2);
          border-radius: 50%;
          background: var(--dsw-alias-bg-layer-2);
          color: var(--dsw-alias-label-secondary);
          box-shadow: var(--dsw-shadow-lv1);
          cursor: pointer;
        }
        .fc-composer { position: relative; flex: none; display: flex; flex-direction: column; gap: 4px; padding: 8px 12px 10px; border-top: 1px solid var(--dsw-alias-border-l2); }
        .fc-mention-popover {
          position: absolute;
          left: 12px;
          right: 12px;
          bottom: calc(100% + 4px);
          z-index: 20;
          max-height: 240px;
          overflow-y: auto;
          padding: 4px;
          box-sizing: border-box;
          border: 1px solid var(--dsw-alias-border-l2);
          border-radius: var(--dsw-radius-md);
          background: var(--dsw-alias-bg-layer-2);
          box-shadow: var(--dsw-elevation-prominent);
        }
        .fc-mention-option {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 6px 8px;
          border: 0;
          border-radius: 6px;
          background: transparent;
          color: var(--dsw-alias-label-primary);
          font: inherit;
          font-size: 12px;
          text-align: left;
          cursor: pointer;
        }
        .fc-mention-option:hover, .fc-mention-option[aria-selected="true"] { background: var(--dsw-alias-interactive-bg-hover); }
        .fc-mention-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .fc-mention-empty { padding: 8px; color: var(--dsw-alias-label-tertiary); font-size: 12px; }
        .fc-composer-row { display: flex; align-items: flex-end; gap: 6px; }
        .fc-plus {
          flex: none;
          width: 32px;
          height: 32px;
          padding: 0;
          border: 1px solid var(--dsw-alias-border-l2);
          border-radius: var(--dsw-radius-md);
          background: var(--dsw-alias-bg-layer-1);
          color: var(--dsw-alias-label-secondary);
          font: inherit;
          font-size: 20px;
          line-height: 1;
          cursor: pointer;
        }
        .fc-plus:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
        .fc-plus:disabled { opacity: 0.45; cursor: default; }
        .fc-send { flex: none; height: 32px; }
        .fc-textarea {
          flex: 1;
          min-width: 0;
          width: auto;
          box-sizing: border-box;
          min-height: 32px;
          overflow: hidden;
          resize: none;
          padding: 7px 10px;
          border: 1px solid var(--dsw-alias-border-l2);
          border-radius: var(--dsw-radius-md);
          background: var(--dsw-alias-bg-layer-1);
          color: var(--dsw-alias-label-primary);
          font: inherit;
          font-size: 13px;
          line-height: 18px;
          outline: none;
        }
        .fc-textarea:focus { border-color: var(--dsw-alias-state-business-primary); }
        .fc-composer-foot { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
        .fc-count { margin-right: auto; color: var(--dsw-alias-label-tertiary); font-size: 11px; }
        .fc-count-warn { color: var(--dsw-alias-state-warn-primary); }
        .fc-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 30px;
          padding: 0 12px;
          border: 1px solid var(--dsw-alias-border-l2);
          border-radius: var(--dsw-radius-md);
          background: var(--dsw-alias-button-elevated-fill);
          color: var(--dsw-alias-label-primary);
          font: inherit;
          font-size: 12px;
          cursor: pointer;
          white-space: nowrap;
        }
        .fc-button:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
        .fc-button:disabled { opacity: 0.45; cursor: default; }
        .fc-button-primary {
          border-color: transparent;
          background: var(--dsw-alias-button-primary-fill);
          color: var(--dsw-alias-label-primary-foreground);
        }
        .fc-button-primary:hover:not(:disabled) { background: var(--dsw-alias-button-primary-hover); }
        .fc-login-wrap { flex: 1; overflow-y: auto; padding: 20px 16px; }
        .fc-login-title { margin-bottom: 4px; font-size: 13px; font-weight: 500; }
        .fc-login { display: flex; flex-direction: column; gap: 10px; margin-top: 10px; }
        .fc-login-actions { display: flex; align-items: center; gap: 8px; }
        .fc-register { text-decoration: none; }
        .fc-field { display: flex; flex-direction: column; gap: 5px; }
        .fc-label { color: var(--dsw-alias-label-secondary); font-size: 12px; }
        .fc-input {
          box-sizing: border-box;
          width: 100%;
          height: 32px;
          padding: 0 10px;
          border: 1px solid var(--dsw-alias-border-l2);
          border-radius: var(--dsw-radius-md);
          background: var(--dsw-alias-bg-layer-1);
          color: var(--dsw-alias-label-primary);
          font: inherit;
          font-size: 13px;
          outline: none;
        }
        .fc-input:focus { border-color: var(--dsw-alias-state-business-primary); }
        .fc-input:focus-visible, .fc-textarea:focus-visible { outline: 2px solid var(--dsw-focus-ring-color); outline-offset: 1px; }
        .fc-check { display: flex; align-items: center; gap: 7px; color: var(--dsw-alias-label-secondary); font-size: 12px; cursor: pointer; }
        .fc-hint { margin: 0; color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 18px; }
        .fc-note { margin: 12px 0 0; color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 18px; }
        .fc-error { margin: 0; color: var(--dsw-alias-state-error-primary); font-size: 12px; line-height: 18px; }
        .fc-settings { display: flex; flex-direction: column; gap: 24px; padding: 20px 0 32px; box-sizing: border-box; }
        .fc-settings .fc-button { height: 34px; font-size: 13px; }
        .fc-settings .fc-panel { border-radius: var(--dsw-radius-lg); padding: 16px 18px; border: 1px solid var(--dsw-alias-settings-card-stroke); }
        .fc-settings .fc-hint, .fc-settings .fc-note { font-size: 13px; line-height: 19px; }
        .fc-section { display: flex; flex-direction: column; gap: 8px; }
        .fc-section-title { margin: 0; color: var(--dsw-alias-label-primary); font-size: 14px; font-weight: 500; line-height: 20px; }
        .fc-panel {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 14px 16px;
          border-radius: var(--dsw-radius-md);
          background: var(--dsw-alias-bg-module-platform);
        }
        .fc-account { flex-direction: row; align-items: center; }
        .fc-account-body { min-width: 0; flex: 1; }
        .fc-account-name { overflow: hidden; font-size: 13px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
        .fc-account-meta { color: var(--dsw-alias-label-tertiary); font-size: 12px; }
        .fc-segmented {
          display: inline-flex;
          gap: 2px;
          align-self: flex-start;
          padding: 2px;
          border: 1px solid var(--dsw-alias-border-l2);
          border-radius: var(--dsw-radius-md);
          background: var(--dsw-alias-bg-layer-1);
        }
        .fc-segment {
          height: 26px;
          padding: 0 12px;
          border: 0;
          border-radius: 6px;
          background: transparent;
          color: var(--dsw-alias-label-secondary);
          font: inherit;
          font-size: 12px;
          cursor: pointer;
        }
        .fc-segment-active { background: var(--dsw-alias-button-elevated-fill); color: var(--dsw-alias-label-primary); box-shadow: var(--dsw-shadow-lv1); }
        .fc-row { display: flex; align-items: center; gap: 16px; }
        .fc-row-body { min-width: 0; flex: 1; }
        .fc-row-title { font-size: 13px; }
        .fc-switch {
          position: relative;
          flex: none;
          width: 36px;
          height: 20px;
          padding: 0;
          border: 0;
          border-radius: 999px;
          background: var(--dsw-alias-bg-layer-3);
          cursor: pointer;
          transition: background 120ms ease;
        }
        .fc-switch-on { background: var(--dsw-alias-state-business-primary); }
        .fc-switch-thumb {
          position: absolute;
          top: 2px;
          left: 2px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--dsw-alias-switch-thumb);
          transition: transform 120ms ease;
        }
        .fc-switch-on .fc-switch-thumb { transform: translateX(16px); }
        .fc-header-entry {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          padding: 0;
          border: 0;
          border-radius: 28px;
          background: transparent;
          color: var(--dsw-alias-label-tertiary);
          cursor: pointer;
        }
        .fc-header-entry:hover { color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-interactive-bg-hover); }
        .fc-header-entry:focus-visible { outline: 2px solid var(--dsw-focus-ring-color); outline-offset: 1px; }
        .fc-badge {
          position: absolute;
          top: 4px;
          right: 4px;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--dsw-alias-state-business-primary);
          box-shadow: 0 0 0 2px var(--dsw-alias-bg-base);
        }
        @media (prefers-reduced-motion: reduce) {
          .fc-switch, .fc-switch-thumb { transition: none; }
        }
      `)
    }

    /** Open the chat tab in the on-screen Session, ignoring the no-Session error. */
    function openChat() {
      try {
        sharedContext?.sidebarRight.openTab(TAB_KIND)
      } catch {
        // Without a Session there is no right Sidebar to open into.
      }
    }

    /** React hook bound to the module's single store. */
    function useStore() {
      return useSyncExternalStore(sharedStore.subscribe, sharedStore.getSnapshot, sharedStore.getSnapshot)
    }

    return {
      inject: ['slots', 'locale', 'sidebarRightTabs', 'sidebarRight'],
      apply(ctx) {
        sharedContext = ctx
        const t = ctx.locale.bind(NS)
        sharedStore = createStore(t)

        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'fishpi-chat copy')

        ctx.effect(() => ctx.sidebarRightTabs.register({
          id: TAB_ID,
          kind: TAB_KIND,
          keepMounted: true,
          priority: 'extension',
          title: () => t('tabTitle'),
          guide: [{
            id: 'open',
            order: 6,
            title: () => t('guide.title'),
            description: () => t('guide.description'),
            icon: IconFish,
          }],
        }), 'fishpi-chat tab type')

        ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
          name: 'sidebar.right.pane.tab',
          key: TAB_ID,
          locale: NS,
        }, ChatTabBody)), 'fishpi-chat tab body')

        ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register({
          name: 'sidebar.right.pane.tab.title',
          key: TAB_ID,
          locale: NS,
        }, ChatTabTitle)), 'fishpi-chat tab title')

        ctx.effect(() => ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
          name: 'conversation.session.header.utilities',
          id: 'fishpi-chat',
          order: -6,
          locale: NS,
        }, HeaderButton)), 'fishpi-chat header button')

        ctx.effect(() => ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: 'fishpi-chat',
          order: 40,
          label: () => t('nav'),
          locale: NS,
        }, SettingsSection)), 'fishpi-chat settings section')

        ctx.effect(() => ctx.slots.inject('settings.section.icon', () => ctx.slots.register({
          name: 'settings.section.icon',
          id: 'fishpi-chat',
          locale: NS,
        }, SettingsIcon)), 'fishpi-chat settings icon')

        const lifetime = new AbortController()
        const ownStore = sharedStore
        const onVisibility = () => { sharedStore?.clearUnreadIfVisible() }
        document.addEventListener('visibilitychange', onVisibility)
        ctx.effect(() => () => {
          document.removeEventListener('visibilitychange', onVisibility)
          lifetime.abort()
          if (sharedStore === ownStore) ownStore.dispose()
        }, 'fishpi-chat lifetime')

        void sharedStore.init(lifetime.signal)
      },
    }
  },
})
;
